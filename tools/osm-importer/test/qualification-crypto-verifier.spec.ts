import { generateKeyPairSync, sign } from 'node:crypto';
import {
  verifySignatureMathematics,
  verifySignedDocument,
  inspectVerifiedDocument,
} from '../src/qualification-crypto-verifier';
import {
  authorizeTestAuthority,
  loadIsolatedTestRegistry,
  productionAuthorityRegistry,
} from '../src/qualification-authority-registry';
import {
  isolatedTestClock,
  systemDiagnosticClock,
  unavailableTrustedClock,
} from '../src/qualification-trusted-clock';
import {
  bytesOf,
  signedDocument,
  testAuthority,
  testClock,
  testEnvelope,
  testRegistry,
  TEST_AUTHORITY,
  TEST_KEY_ID,
  TEST_ROOT,
  TEST_SIGNER,
  TEST_OTHER_SIGNER,
} from './qualification-verification-test-fixtures';

function signed() {
  const reading = testClock(),
    registry = testRegistry({}, reading);
  return {
    reading,
    registry,
    doc: signedDocument(testEnvelope(), registry.result, reading),
  };
}
describe('5C.2A detached cryptographic primitives', () => {
  it('real Ed25519 signature verifies exactly the supplied bytes but not issuer authority', () => {
    const f = signed(),
      r = verifySignatureMathematics(
        f.doc.bytes,
        f.doc.input.signatureBase64,
        'Ed25519',
        TEST_SIGNER.publicKey,
        f.reading,
      );
    expect(r).toMatchObject({
      status: 'VERIFIED',
      assurance: 'SIGNATURE_MATHEMATICS',
      scope: 'TECHNICAL_ONLY',
      productionAuthoritative: false,
      qualificationEligible: false,
    });
    expect(r.diagnosticCodes).toContain('ISSUER_NOT_AUTHENTICATED');
    expect(inspectVerifiedDocument(r, 'EVIDENCE', f.reading)).toBeUndefined();
  });
  it('missing bytes or missing public verifier key never verifies mathematics', () => {
    const f = signed();
    expect(
      verifySignatureMathematics(
        undefined,
        f.doc.input.signatureBase64,
        'Ed25519',
        TEST_SIGNER.publicKey,
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
    expect(
      verifySignatureMathematics(
        f.doc.bytes,
        f.doc.input.signatureBase64,
        'Ed25519',
        undefined,
        f.reading,
      ).status,
    ).toBe('INVALID');
    expect(
      verifySignatureMathematics(
        f.doc.bytes,
        f.doc.input.signatureBase64,
        'Ed25519',
        TEST_SIGNER.privateKey,
        f.reading,
      ).status,
    ).toBe('INVALID');
  });
  it('real signature with registry authenticates only an isolated test issuer', () => {
    const f = signed();
    expect(f.doc.result).toMatchObject({
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      productionAuthoritative: false,
      qualificationEligible: false,
      assurance: 'TEST_DOCUMENT_AUTHENTICITY',
    });
    expect(
      inspectVerifiedDocument(f.doc.result, 'EVIDENCE', f.reading)?.envelope
        .subjectId,
    ).toBe('TEST_DOCUMENT');
  });
  it.each(['none', 'HS256', 'RSA-SHA1', 'Ed448', 'ed25519', 'SHA256'])(
    'algorithm %s cannot downgrade Ed25519 policy',
    (algorithm) => {
      const f = signed(),
        r = verifySignedDocument(
          { ...f.doc.input, algorithm },
          f.registry.result,
          f.reading,
        );
      expect(r.status).toBe('INVALID');
      expect(r.diagnosticCodes).toContain('ALGORITHM_NOT_ALLOWED');
    },
  );
  it.each(['', '!!!', 'AAAA', 'AA==', 'A'.repeat(86), 'A'.repeat(88)])(
    'signature encoding/corruption %s fails closed',
    (signatureBase64) => {
      const f = signed();
      expect(
        verifySignedDocument(
          { ...f.doc.input, signatureBase64 },
          f.registry.result,
          f.reading,
        ).status,
      ).toBe('INVALID');
    },
  );
  it('a bit-flipped signature fails native verification', () => {
    const f = signed(),
      signature = Buffer.from(f.doc.input.signatureBase64!, 'base64');
    signature[0] ^= 1;
    expect(
      verifySignedDocument(
        { ...f.doc.input, signatureBase64: signature.toString('base64') },
        f.registry.result,
        f.reading,
      ).diagnosticCodes,
    ).toContain('SIGNATURE_INVALID');
  });
  it.each(['tamper', 'truncate'])(
    '%s signed document bytes fails native verification',
    (mode) => {
      const f = signed(),
        bytes = Buffer.from(f.doc.bytes);
      if (mode === 'tamper') bytes[10] ^= 1;
      const r = verifySignedDocument(
        {
          ...f.doc.input,
          bytes: mode === 'truncate' ? bytes.subarray(0, -1) : bytes,
        },
        f.registry.result,
        f.reading,
      );
      expect(r.status).toBe('INVALID');
      expect(r.diagnosticCodes).toContain('SIGNATURE_INVALID');
    },
  );
  it('signature from an unrelated private key cannot authenticate a registered key ID', () => {
    const f = signed();
    expect(
      verifySignedDocument(
        {
          ...f.doc.input,
          signatureBase64: sign(
            null,
            f.doc.bytes,
            TEST_OTHER_SIGNER.privateKey,
          ).toString('base64'),
        },
        f.registry.result,
        f.reading,
      ).status,
    ).toBe('INVALID');
  });
  it('public key and certificate chain supplied by the payload are rejected as anchors', () => {
    const f = signed();
    for (const extra of [
      { publicKey: TEST_OTHER_SIGNER.publicKey },
      { certificateChain: ['SELF_SIGNED'] },
    ]) {
      expect(
        verifySignedDocument(
          { ...f.doc.input, ...extra },
          f.registry.result,
          f.reading,
        ).diagnosticCodes,
      ).toContain('PAYLOAD_TRUST_ANCHOR_REJECTED');
    }
  });
  it('a valid signature alone cannot certify an unregistered authority', () => {
    const f = signed(),
      r = verifySignedDocument(
        { ...f.doc.input, authorityId: 'ATTACKER' },
        f.registry.result,
        f.reading,
      );
    expect(r.status).toBe('UNTRUSTED_ISSUER');
  });
  it.each([undefined, null, {}, { status: 'VERIFIED', scope: 'TEST_ONLY' }])(
    'missing/forged registry %j is unavailable',
    (registry) => {
      const f = signed();
      expect(
        verifySignedDocument(f.doc.input, registry, f.reading).status,
      ).toBe('VERIFIER_UNAVAILABLE');
    },
  );
  it('production registry is explicitly unconfigured', () => {
    const f = signed(),
      production = productionAuthorityRegistry();
    expect(production.status).toBe('VERIFIER_UNAVAILABLE');
    expect(
      verifySignedDocument(f.doc.input, production, f.reading).status,
    ).toBe('VERIFIER_UNAVAILABLE');
  });
  it.each(['system', 'unavailable', 'forged'])(
    'clock %s cannot establish test issuer authenticity',
    (kind) => {
      const f = signed(),
        clock =
          kind === 'system'
            ? systemDiagnosticClock.read()
            : kind === 'unavailable'
              ? unavailableTrustedClock.read()
              : {
                  kind: 'TEST_ONLY',
                  timestamp: '2026-06-01T00:00:00Z',
                  sourceReference: 'ISOLATED_TEST_CLOCK',
                };
      expect(
        verifySignedDocument(f.doc.input, f.registry.result, clock).status,
      ).toBe('VERIFIER_UNAVAILABLE');
    },
  );
  it('a freshly re-signed malformed JSON document never defaults to VERIFIED', () => {
    const f = signed(),
      bytes = Buffer.from('{broken');
    expect(
      verifySignedDocument(
        {
          ...f.doc.input,
          bytes,
          signatureBase64: sign(null, bytes, TEST_SIGNER.privateKey).toString(
            'base64',
          ),
        },
        f.registry.result,
        f.reading,
      ).diagnosticCodes,
    ).toContain('DOCUMENT_PARSE_OR_VERIFICATION_ERROR');
  });
  it('signed noncanonical/duplicate-key envelope is rejected', () => {
    const f = signed(),
      bytes = Buffer.from('{"x":1,"x":2}');
    expect(
      verifySignedDocument(
        {
          ...f.doc.input,
          bytes,
          signatureBase64: sign(null, bytes, TEST_SIGNER.privateKey).toString(
            'base64',
          ),
        },
        f.registry.result,
        f.reading,
      ).status,
    ).toBe('INVALID');
  });
  it.each([
    { subjectId: 'WRONG' },
    { category: 'EXEMPTION' as const },
    { criterion: 'LEGAL_ACCESS' as const },
  ])(
    'unsigned envelope selector %j cannot replace signed metadata',
    (patch) => {
      const f = signed();
      expect(
        verifySignedDocument(
          { ...f.doc.input, ...patch },
          f.registry.result,
          f.reading,
        ).diagnosticCodes,
      ).toContain('SIGNED_ENVELOPE_IDENTITY_MISMATCH');
    },
  );
  it('UTF-8 BOM cannot silently bypass the signed canonical byte policy', () => {
    const f = signed(),
      bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), f.doc.bytes]);
    expect(
      verifySignedDocument(
        {
          ...f.doc.input,
          bytes,
          signatureBase64: sign(null, bytes, TEST_SIGNER.privateKey).toString(
            'base64',
          ),
        },
        f.registry.result,
        f.reading,
      ).status,
    ).toBe('INVALID');
  });
  it('non-criterion documents cannot smuggle a criterion selector', () => {
    const reading = testClock(),
      registry = testRegistry({}, reading);
    const doc = signedDocument(
      testEnvelope({ category: 'PROFILE_APPROVAL', criterion: 'LEGAL_ACCESS' }),
      registry.result,
      reading,
    );
    expect(doc.result.diagnosticCodes).toContain(
      'NON_CRITERION_DOCUMENT_REQUIRES_NULL_CRITERION',
    );
  });
  it('JSON copies, object spreads and cast-like shapes lose runtime provenance', () => {
    const f = signed();
    for (const fake of [
      { ...f.doc.result },
      JSON.parse(JSON.stringify(f.doc.result)),
      { status: 'VERIFIED' },
    ])
      expect(
        inspectVerifiedDocument(fake, 'EVIDENCE', f.reading),
      ).toBeUndefined();
    expect(
      inspectVerifiedDocument(f.doc.result, 'EXEMPTION', f.reading),
    ).toBeUndefined();
  });
  it('returned envelopes are deeply frozen and document buffers are not retained by reference', () => {
    const f = signed();
    expect(
      Object.isFrozen(
        inspectVerifiedDocument(f.doc.result, 'EVIDENCE', f.reading)?.envelope
          .body,
      ),
    ).toBe(true);
    f.doc.bytes.fill(0);
    expect(
      inspectVerifiedDocument(f.doc.result, 'EVIDENCE', f.reading)?.envelope
        .subjectId,
    ).toBe('TEST_DOCUMENT');
  });
});

describe('5C.2A signed authority registry', () => {
  it('root signature is required even for an authority named in the registry', () => {
    const f = testRegistry(),
      r = loadIsolatedTestRegistry(
        { ...f.config, signatureBase64: '' },
        testClock(),
      );
    expect(r.status).toBe('INVALID');
    expect(r.diagnosticCodes).toContain('REGISTRY_SIGNATURE_INVALID');
  });
  it('tampered registry bytes invalidate the root signature', () => {
    const f = testRegistry(),
      bytes = Buffer.from(f.config.bytes);
    bytes[20] ^= 1;
    expect(
      loadIsolatedTestRegistry({ ...f.config, bytes }, testClock()).status,
    ).toBe('INVALID');
  });
  it('a missing trust root cannot authenticate a signed registry', () => {
    const f = testRegistry();
    expect(
      loadIsolatedTestRegistry(
        { ...f.config, rootPublicKey: undefined } as unknown as Parameters<
          typeof loadIsolatedTestRegistry
        >[0],
        testClock(),
      ).status,
    ).toBe('UNTRUSTED_ISSUER');
  });
  it('registry signed by an unconfigured root is rejected', () => {
    const f = testRegistry();
    expect(
      loadIsolatedTestRegistry(
        { ...f.config, rootPublicKey: TEST_OTHER_SIGNER.publicKey },
        testClock(),
      ).status,
    ).toBe('INVALID');
  });
  it('valid signer outside allowed criterion is denied', () => {
    const reading = testClock(),
      reg = testRegistry(
        { authorities: [testAuthority({ allowedCriteria: ['LEGAL_ACCESS'] })] },
        reading,
      );
    expect(
      signedDocument(testEnvelope(), reg.result, reading).result,
    ).toMatchObject({
      status: 'UNTRUSTED_ISSUER',
      diagnosticCodes: ['AUTHORITY_SCOPE_DENIED'],
    });
  });
  it('valid signer outside allowed document category is denied', () => {
    const reading = testClock(),
      reg = testRegistry(
        {
          authorities: [
            testAuthority({ allowedCategories: ['PROFILE_APPROVAL'] }),
          ],
        },
        reading,
      );
    expect(
      signedDocument(testEnvelope(), reg.result, reading).result.status,
    ).toBe('UNTRUSTED_ISSUER');
  });
  it.each([
    ['revoked', { authorityStatus: 'REVOKED' }, 'REVOKED'],
    [
      'unknown revocation',
      { authorityStatus: 'UNKNOWN' },
      'VERIFIER_UNAVAILABLE',
    ],
    ['expired authority', { validUntil: '2026-05-01T00:00:00Z' }, 'EXPIRED'],
    [
      'expired test certificate metadata',
      { certificateValidUntil: '2026-05-01T00:00:00Z' },
      'EXPIRED',
    ],
  ] as const)('%s fails closed', (_label, patch, status) => {
    const reading = testClock(),
      reg = testRegistry({ authorities: [testAuthority(patch)] }, reading);
    expect(
      signedDocument(testEnvelope(), reg.result, reading).result.status,
    ).toBe(status);
  });
  it.each(['duplicate authority', 'duplicate key'])(
    '%s ID rejects registry schema',
    (kind) => {
      const authorities = [
        testAuthority(),
        testAuthority(
          kind === 'duplicate key'
            ? { authorityId: 'DIFFERENT' }
            : { keyId: 'OTHER' },
        ),
      ];
      const r = testRegistry({ authorities }).result;
      expect(r.status).toBe('INVALID');
      expect(r.diagnosticCodes).toContain(
        kind === 'duplicate key'
          ? 'DUPLICATE_KEY_ID'
          : 'DUPLICATE_AUTHORITY_ID',
      );
    },
  );
  it('unsupported authority key algorithm rejects the registry', () => {
    expect(
      testRegistry({ authorities: [testAuthority({ algorithm: 'RSA-SHA1' })] })
        .result.status,
    ).toBe('INVALID');
  });
  it('expired registry cannot authenticate an issuer', () =>
    expect(
      testRegistry({ validUntil: '2026-05-01T00:00:00Z' }).result.status,
    ).toBe('EXPIRED'));
  it('stale or future revocation snapshots are not trusted', () => {
    for (const revocationCheckedAt of [
      '2026-05-31T00:00:00Z',
      '2026-06-02T00:00:00Z',
    ])
      expect(testRegistry({ revocationCheckedAt }).result.status).toBe(
        'VERIFIER_UNAVAILABLE',
      );
  });
  it('document revocation is taken from signed registry, not document claim', () => {
    const reading = testClock(),
      reg = testRegistry({ revokedDocumentIds: ['TEST_DOCUMENT'] }, reading);
    expect(
      signedDocument(testEnvelope(), reg.result, reading).result.status,
    ).toBe('REVOKED');
  });
  it('receipt use rechecks revocation freshness and time rather than trusting a cached VERIFIED label', () => {
    const f = signed(),
      later = isolatedTestClock('2026-06-01T02:00:00Z').read();
    expect(
      inspectVerifiedDocument(f.doc.result, 'EVIDENCE', later),
    ).toBeUndefined();
  });
  it('mutating caller registry buffer cannot change the verified registry snapshot', () => {
    const f = testRegistry();
    f.config.bytes.fill(0);
    expect(
      authorizeTestAuthority(
        f.result,
        testClock(),
        TEST_AUTHORITY,
        TEST_KEY_ID,
        'EVIDENCE',
        'STRUCTURAL_LOAD_CAPACITY',
        'TEST_DOCUMENT',
      ).status,
    ).toBe('VERIFIED');
  });
  it('non-public or wrong-type root cannot be treated as a trust root', () => {
    const f = testRegistry(),
      rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    for (const rootPublicKey of [TEST_ROOT.privateKey, rsa.publicKey])
      expect(
        loadIsolatedTestRegistry({ ...f.config, rootPublicKey }, testClock())
          .status,
      ).toBe('UNTRUSTED_ISSUER');
  });
});
