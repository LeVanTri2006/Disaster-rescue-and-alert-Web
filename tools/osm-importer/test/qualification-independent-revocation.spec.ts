import { sign } from 'node:crypto';
import {
  evaluateTestRevocation,
  LifecycleStatus,
} from '../src/qualification-revocation-policy';
import {
  authorizeTestAuthority,
  loadIsolatedTestRegistry,
} from '../src/qualification-authority-registry';
import {
  inspectVerifiedDocument,
  verifySignedDocument,
} from '../src/qualification-crypto-verifier';
import * as revocationPolicy from '../src/qualification-revocation-policy';
import * as cryptoVerifier from '../src/qualification-crypto-verifier';
import { createTestOnlyVerificationOrchestrator } from '../src/qualification-verification-orchestrator';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import {
  pipelineFixture,
  pipelineAuthorities,
  resignRegistry,
  assertLocked,
} from './qualification-verification-pipeline-fixtures';
import {
  testRegistry,
  testAuthority,
  testClock,
  testEnvelope,
  signedDocument,
  TEST_AUTHORITY,
  TEST_KEY_ID,
  TEST_NOW,
  TEST_ROOT,
  TEST_OTHER_SIGNER,
  bytesOf,
} from './qualification-verification-test-fixtures';

const combinations: readonly [
  LifecycleStatus,
  LifecycleStatus,
  string | null,
][] = [
  ['ACTIVE', 'ACTIVE', null],
  ['ACTIVE', 'REVOKED', 'KEY_REVOKED'],
  ['REVOKED', 'ACTIVE', 'AUTHORITY_REVOKED'],
  ['SUSPENDED', 'ACTIVE', 'AUTHORITY_SUSPENDED'],
  ['ACTIVE', 'SUSPENDED', 'KEY_SUSPENDED'],
  ['UNKNOWN', 'ACTIVE', 'AUTHORITY_STATUS_UNKNOWN'],
  ['ACTIVE', 'UNKNOWN', 'KEY_STATUS_UNKNOWN'],
  ['EXPIRED', 'ACTIVE', 'AUTHORITY_EXPIRED'],
  ['ACTIVE', 'EXPIRED', 'KEY_EXPIRED'],
];
describe('5C.2C independent authority/key snapshot lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(combinations)(
    '%s authority / %s key: policy and end-to-end pipeline',
    (authorityStatus, keyStatus, reason) => {
      const f = pipelineFixture(),
        request = resignRegistry(f, {
          authorities: pipelineAuthorities().map((a) => ({
            ...a,
            authorityStatus,
            keyStatus,
          })),
        });
      const reg = loadIsolatedTestRegistry(
        { ...f.registry.config, ...request.registry },
        testClock(),
      );
      expect(reg.status).toBe('VERIFIED');
      const result = evaluateTestRevocation(
        reg,
        testClock(),
        TEST_AUTHORITY,
        TEST_KEY_ID,
        'DOC',
      );
      const out = createTestOnlyVerificationOrchestrator(f.context).verify(
        request,
      );
      assertLocked(out);
      expect(result.details?.authority.status).toBe(authorityStatus);
      expect(result.details?.key.status).toBe(keyStatus);
      if (reason) {
        expect(result.status).not.toBe('VERIFIED');
        expect(result.diagnosticCodes).toContain(reason);
        expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
        expect(out.diagnosticCodes).toContain(reason);
      } else {
        expect(result.status).toBe('VERIFIED');
        expect(out.state).toBe('VERIFIED_TEST_ONLY');
      }
    },
  );
  it.each(['authorityStatus', 'keyStatus'])(
    'missing %s is never default ACTIVE',
    (field) => {
      const row: Record<string, unknown> = testAuthority();
      delete row[field];
      const reg = testRegistry({ authorities: [row] });
      expect(reg.result.status).toBe('INVALID');
      expect(reg.result.diagnosticCodes).toContain(
        field === 'authorityStatus'
          ? 'AUTHORITY_STATUS_MISSING'
          : 'KEY_STATUS_MISSING',
      );
      const f = pipelineFixture(),
        out = createTestOnlyVerificationOrchestrator(f.context).verify(
          resignRegistry(f, { authorities: [row] }),
        );
      expect(out.state).toBe('REJECTED');
      assertLocked(out);
    },
  );
  it('retains simultaneous authority/key/document revocation reasons', () => {
    const f = testRegistry({
      authorities: [
        testAuthority({ authorityStatus: 'SUSPENDED', keyStatus: 'REVOKED' }),
      ],
      revokedDocumentIds: ['DOC'],
    });
    const result = evaluateTestRevocation(
      f.result,
      testClock(),
      TEST_AUTHORITY,
      TEST_KEY_ID,
      'DOC',
    );
    expect(result.diagnosticCodes).toEqual(
      expect.arrayContaining([
        'AUTHORITY_SUSPENDED',
        'KEY_REVOKED',
        'DOCUMENT_REVOKED_BY_REGISTRY',
      ]),
    );
  });
  it.each([
    ['authority', { validUntil: '2026-05-31T00:00:00Z' }, 'AUTHORITY_EXPIRED'],
    ['key', { keyValidUntil: '2026-05-31T00:00:00Z' }, 'KEY_EXPIRED'],
    [
      'key certificate',
      { certificateValidUntil: '2026-05-31T00:00:00Z' },
      'KEY_CERTIFICATE_METADATA_EXPIRED',
    ],
  ])('%s effective period independently expires', (_label, patch, code) => {
    const f = testRegistry({ authorities: [testAuthority(patch)] });
    const r = evaluateTestRevocation(
      f.result,
      testClock(),
      TEST_AUTHORITY,
      TEST_KEY_ID,
      'DOC',
    );
    expect(r.status).toBe('EXPIRED');
    expect(r.diagnosticCodes).toContain(code);
  });
  it.each([
    [
      'v1',
      { schema: 'qualification-test-registry-v1' },
      'REGISTRY_SCHEMA_VERSION_UNSUPPORTED',
    ],
    [
      'future version',
      { schema: 'qualification-test-registry-v3' },
      'REGISTRY_SCHEMA_VERSION_UNSUPPORTED',
    ],
    [
      'wrong policy',
      { revocationPolicyVersion: 'legacy' },
      'REVOCATION_POLICY_MISMATCH',
    ],
    [
      'missing policy',
      { revocationPolicyVersion: null },
      'REVOCATION_POLICY_MISMATCH',
    ],
    [
      'source unavailable',
      { revocationSourceStatus: 'UNAVAILABLE' },
      'REVOCATION_SOURCE_UNAVAILABLE',
    ],
  ])('native signed registry %s fails closed', (_label, patch, code) => {
    const f = testRegistry(patch);
    expect(f.result.status).not.toBe('VERIFIED');
    expect(f.result.diagnosticCodes).toContain(code);
  });
  it('v2 cannot accept the combined legacy revocation field', () => {
    expect(
      testRegistry({
        authorities: [testAuthority({ revocationStatus: 'ACTIVE' })],
      }).result.diagnosticCodes,
    ).toContain('LEGACY_COMBINED_REVOCATION_FIELD_REJECTED');
  });
  it.each(['bytes', 'signature', 'duplicate keys', 'malformed JSON'])(
    'registry fault: %s',
    (fault) => {
      const f = testRegistry();
      let config = f.config;
      if (fault === 'bytes')
        config = {
          ...config,
          bytes: Buffer.concat([config.bytes, Buffer.from(' ')]),
        };
      if (fault === 'signature')
        config = {
          ...config,
          signatureBase64: Buffer.alloc(64).toString('base64'),
        };
      if (fault === 'duplicate keys') {
        const bytes = bytesOf({
          ...f.data,
          authorities: [
            testAuthority(),
            testAuthority({ authorityId: 'OTHER' }),
          ],
        });
        config = {
          ...config,
          bytes,
          signatureBase64: sign(null, bytes, TEST_ROOT.privateKey).toString(
            'base64',
          ),
        };
      }
      if (fault === 'malformed JSON') {
        const bytes = Buffer.from('{');
        config = {
          ...config,
          bytes,
          signatureBase64: sign(null, bytes, TEST_ROOT.privateKey).toString(
            'base64',
          ),
        };
      }
      const r = loadIsolatedTestRegistry(config, testClock());
      expect(r.status).toBe('INVALID');
    },
  );
  it('forged lifecycle facts/spread/prototype/JSON receipts never authenticate revocation', () => {
    const r = testRegistry().result;
    for (const forged of [
      { ...r },
      JSON.parse(JSON.stringify(r)),
      Object.create(r),
      { status: 'VERIFIED', authorityStatus: 'ACTIVE', keyStatus: 'ACTIVE' },
    ]) {
      const result = evaluateTestRevocation(
        forged,
        testClock(),
        TEST_AUTHORITY,
        TEST_KEY_ID,
        'DOC',
      );
      expect(result.status).toBe('VERIFIER_UNAVAILABLE');
      expect(result.diagnosticCodes).toContain(
        'REGISTRY_UNAVAILABLE_OR_FORGED',
      );
    }
  });
  it('document receipt spread/prototype/JSON copies and other-registry reuse are rejected', () => {
    const r = testRegistry(),
      doc = signedDocument(testEnvelope(), r.result);
    for (const forged of [
      { ...doc.result },
      JSON.parse(JSON.stringify(doc.result)),
      Object.create(doc.result),
    ])
      expect(
        inspectVerifiedDocument(forged, 'EVIDENCE', testClock(), r.result),
      ).toBeUndefined();
    const other = testRegistry({ registryVersion: 'DIFFERENT' });
    expect(
      inspectVerifiedDocument(
        doc.result,
        'EVIDENCE',
        testClock(),
        other.result,
      ),
    ).toBeUndefined();
    expect(
      inspectVerifiedDocument(doc.result, 'EVIDENCE', testClock(), r.result),
    ).toBeDefined();
  });
  it('authority and key cannot be replaced by caller status after signature verification', () => {
    const r = testRegistry(),
      doc = signedDocument(testEnvelope(), r.result);
    const other = testRegistry({
      authorities: [
        testAuthority({
          publicKeyPem: TEST_OTHER_SIGNER.publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString(),
        }),
      ],
    });
    expect(
      inspectVerifiedDocument(
        doc.result,
        'EVIDENCE',
        testClock(),
        other.result,
      ),
    ).toBeUndefined();
    expect(
      verifySignedDocument(doc.input, other.result, testClock()).status,
    ).toBe('INVALID');
    expect(
      authorizeTestAuthority(
        { ...r.result, keyStatus: 'ACTIVE' },
        testClock(),
        TEST_AUTHORITY,
        TEST_KEY_ID,
        'EVIDENCE',
        'STRUCTURAL_LOAD_CAPACITY',
        'DOC',
      ).status,
    ).not.toBe('VERIFIED');
  });
  it.each(['keyRevokedAt', 'authorityRevokedAt'])(
    'signed scheduled %s invalidates an already verified document',
    (field) => {
      const r = testRegistry({
          authorities: [testAuthority({ [field]: '2026-06-01T00:00:01Z' })],
        }),
        doc = signedDocument(testEnvelope(), r.result);
      expect(doc.result.status).toBe('VERIFIED');
      const later = isolatedTestClock('2026-06-01T00:00:02Z').read();
      expect(
        inspectVerifiedDocument(doc.result, 'EVIDENCE', later),
      ).toBeUndefined();
      const revocation = evaluateTestRevocation(
        r.result,
        later,
        TEST_AUTHORITY,
        TEST_KEY_ID,
        'DOC',
      );
      expect(revocation.status).toBe('REVOKED');
      expect(revocation.diagnosticCodes).toContain(
        field === 'keyRevokedAt' ? 'KEY_REVOKED' : 'AUTHORITY_REVOKED',
      );
    },
  );
  it.each(['KEY', 'AUTHORITY'])(
    '%s becomes revoked midway through native pipeline',
    (component) => {
      const f = pipelineFixture();
      let advance = false;
      const actual = cryptoVerifier.verifySignedDocument;
      jest
        .spyOn(cryptoVerifier, 'verifySignedDocument')
        .mockImplementation((...args) => {
          const result = actual(...args);
          if (
            result.status === 'VERIFIED' &&
            args[0].category ===
              (component === 'KEY' ? 'EVIDENCE' : 'PROFILE_APPROVAL')
          )
            advance = true;
          return result;
        });
      const request = resignRegistry(f, {
        authorities: pipelineAuthorities().map((a) => ({
          ...a,
          [component === 'KEY' ? 'keyRevokedAt' : 'authorityRevokedAt']:
            '2026-06-01T00:00:01Z',
        })),
      });
      const out = createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock: {
          read: () =>
            isolatedTestClock(
              advance ? '2026-06-01T00:00:02Z' : TEST_NOW,
            ).read(),
        },
      }).verify(request);
      expect(advance).toBe(true);
      expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
      expect(out.diagnosticCodes).toContain(`${component}_REVOKED`);
      assertLocked(out);
    },
  );
  it('a newly signed revoked snapshot does not silently refresh an old receipt', () => {
    const active = testRegistry(),
      doc = signedDocument(testEnvelope(), active.result);
    const revoked = testRegistry({
      registryVersion: 'NEXT',
      authorities: [testAuthority({ keyStatus: 'REVOKED' })],
    });
    expect(
      inspectVerifiedDocument(
        doc.result,
        'EVIDENCE',
        testClock(),
        revoked.result,
      ),
    ).toBeUndefined();
    expect(
      verifySignedDocument(doc.input, revoked.result, testClock())
        .diagnosticCodes,
    ).toContain('KEY_REVOKED');
    // The API is a signed snapshot, not a live subscription. Revalidate against
    // an explicitly supplied new registry; do not claim the old snapshot updates.
  });
  it.each([
    ['ACTIVE', 'REVOKED'],
    ['REVOKED', 'ACTIVE'],
  ] as const)(
    'audit retains authority=%s and key=%s as separate facts',
    (authorityStatus, keyStatus) => {
      const f = pipelineFixture(),
        request = resignRegistry(f, {
          authorities: pipelineAuthorities().map((a) => ({
            ...a,
            authorityStatus,
            keyStatus,
          })),
        });
      const out = createTestOnlyVerificationOrchestrator(f.context).verify(
        request,
      );
      expect(
        out.audit.find((s) => s.stepId === 'manifest:revocation:authority')
          ?.lifecycleStatus,
      ).toBe(authorityStatus);
      expect(
        out.audit.find((s) => s.stepId === 'manifest:revocation:key')
          ?.lifecycleStatus,
      ).toBe(keyStatus);
      expect(out.audit[out.audit.length - 1]?.pipelineState).toBe('REJECTED');
      expect(out.state).toBe('REJECTED');
      assertLocked(out);
      expect(JSON.stringify(out.audit)).not.toContain('BEGIN PUBLIC KEY');
    },
  );
  it('expired key certificate never overwrites explicit KEY_REVOKED', () => {
    const reg = testRegistry({
      authorities: [
        testAuthority({
          keyStatus: 'REVOKED',
          certificateValidUntil: '2026-05-31T00:00:00Z',
        }),
      ],
    });
    const result = evaluateTestRevocation(
      reg.result,
      testClock(),
      TEST_AUTHORITY,
      TEST_KEY_ID,
      'DOC',
    );
    expect(result.status).toBe('REVOKED');
    expect(result.details?.key.status).toBe('REVOKED');
    expect(result.diagnosticCodes).toEqual(
      expect.arrayContaining([
        'KEY_REVOKED',
        'KEY_CERTIFICATE_METADATA_EXPIRED',
      ]),
    );
  });
  it.each(['keyValidFrom', 'keyValidUntil', 'authorityStatus', 'keyStatus'])(
    'mandatory entry field %s cannot be omitted',
    (field) => {
      const row: Record<string, unknown> = testAuthority();
      delete row[field];
      expect(testRegistry({ authorities: [row] }).result.status).toBe(
        'INVALID',
      );
    },
  );
  it('forged clock cannot authenticate an otherwise valid revocation snapshot', () => {
    const reg = testRegistry();
    const result = evaluateTestRevocation(
      reg.result,
      { kind: 'TEST_ONLY', timestamp: TEST_NOW, sourceReference: 'FORGED' },
      TEST_AUTHORITY,
      TEST_KEY_ID,
      'DOC',
    );
    expect(result.status).toBe('VERIFIER_UNAVAILABLE');
    expect(result.diagnosticCodes).toContain('TEST_CLOCK_REQUIRED');
  });
  it('revocation evaluator exception never becomes a successful pipeline', () => {
    const f = pipelineFixture();
    jest
      .spyOn(revocationPolicy, 'evaluateTestRevocation')
      .mockImplementationOnce(() => {
        throw new Error('REVOCATION_PRIVATE_FAILURE');
      });
    const out = createTestOnlyVerificationOrchestrator(f.context).verify(
      f.request,
    );
    expect(out.state).toBe('REJECTED');
    expect(out.diagnosticCodes).toContain('UNEXPECTED_VERIFIER_EXCEPTION');
    expect(JSON.stringify(out.audit)).not.toContain(
      'REVOCATION_PRIVATE_FAILURE',
    );
    assertLocked(out);
  });

  it.each(['keyRevokedAt', 'authorityRevokedAt'])(
    'shared final instant preserves %s alongside stale snapshot',
    (field) => {
      const f = pipelineFixture();
      const request = resignRegistry(f, {
        authorities: pipelineAuthorities().map((a) => ({
          ...a,
          [field]: '2026-06-01T00:00:01Z',
        })),
      });
      let reads = 0;
      expect(
        createTestOnlyVerificationOrchestrator({
          ...f.context,
          clock: {
            read: () => {
              reads++;
              return isolatedTestClock(TEST_NOW).read();
            },
          },
        }).verify(request).state,
      ).toBe('VERIFIED_TEST_ONLY');
      const total = reads;
      reads = 0;
      const out = createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock: {
          read: () =>
            isolatedTestClock(
              ++reads >= total - 1 ? '2026-06-01T02:00:00Z' : TEST_NOW,
            ).read(),
        },
      }).verify(request);
      expect(out.state).toBe('REJECTED');
      assertLocked(out);
      expect(out.diagnosticCodes).toEqual(
        expect.arrayContaining([
          'REVOCATION_SNAPSHOT_STALE',
          field === 'keyRevokedAt' ? 'KEY_REVOKED' : 'AUTHORITY_REVOKED',
        ]),
      );
    },
  );
  it('known authority remains independently ACTIVE when the requested key is missing', () => {
    const reg = testRegistry(),
      result = evaluateTestRevocation(
        reg.result,
        testClock(),
        TEST_AUTHORITY,
        'OTHER_KEY',
        'DOC',
      );
    expect(result.status).toBe('UNTRUSTED_ISSUER');
    expect(result.details?.authority.status).toBe('ACTIVE');
    expect(result.details?.key.status).toBe('MISSING');
    expect(result.diagnosticCodes).toContain('KEY_NOT_REGISTERED');
  });
});
