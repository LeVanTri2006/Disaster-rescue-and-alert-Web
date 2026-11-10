import { verify, sign } from 'node:crypto';
import {
  createTestOnlyMultiKeyVerifier,
  revalidateMultiKeyDocument,
  MultiKeySnapshot,
} from '../src/qualification-multikey-registry';
import { loadIsolatedTestRegistry } from '../src/qualification-authority-registry';
import { rawSha256 } from '../src/qualification-verification-json';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import { isolatedTestCheckpointStore } from '../src/qualification-registry-checkpoint';
import {
  multiKeyFixture,
  multiKeySnapshot,
  signedSnapshot,
  signedKeyDocument,
  keyEnvelope,
  V3_KEY1,
  V3_KEY2,
  V3_ROOT,
} from './qualification-multikey-test-fixtures';
import {
  testRegistry,
  testClock,
  TEST_NOW,
} from './qualification-verification-test-fixtures';

function changedKeys(patches: readonly Record<string, unknown>[]): unknown {
  const s = multiKeySnapshot();
  return {
    ...s,
    authorities: [
      {
        ...s.authorities[0],
        keys: s.authorities[0].keys.map((k, i) => ({ ...k, ...patches[i] })),
      },
    ],
  };
}
function nextSnapshot(
  f: ReturnType<typeof multiKeyFixture>,
  patch: Partial<MultiKeySnapshot> = {},
): MultiKeySnapshot {
  return {
    ...f.snapshot,
    snapshotId: 'SNAPSHOT_2',
    snapshotVersion: 2,
    previousSnapshotSha256: rawSha256(f.signed.bytes),
    ...patch,
  };
}
describe('5C.2D multi-key native cryptography and independent lifecycle', () => {
  it.each(['KEY_1', 'KEY_2'])(
    'same authority has two explicitly overlapping ACTIVE keys: %s',
    (keyId) => {
      const f = multiKeyFixture();
      expect(f.receipt.status).toBe('VERIFIED_TEST_ONLY');
      const r = f.verifier.verifyDocument(
        signedKeyDocument(keyEnvelope(keyId)),
        f.receipt,
      );
      expect(r.status).toBe('VERIFIED_TEST_ONLY');
      expect(r.diagnosticCodes).toContain('NATIVE_DOCUMENT_SIGNATURE');
      expect(r.details?.signingTime).toBe('UNAUTHENTICATED');
      expect(r.productionAuthoritative).toBe(false);
    },
  );
  it.each([
    [
      'old expired',
      [{ signingUntil: '2026-05-31T00:00:00Z' }, {}],
      'KEY_1',
      'KEY_NOT_AUTHORIZED_FOR_NEW_SIGNATURES',
    ],
    ['old revoked', [{ keyStatus: 'REVOKED' }, {}], 'KEY_1', 'KEY_REVOKED'],
    ['new revoked', [{}, { keyStatus: 'REVOKED' }], 'KEY_2', 'KEY_REVOKED'],
    [
      'both revoked',
      [{ keyStatus: 'REVOKED' }, { keyStatus: 'REVOKED' }],
      'KEY_1',
      'KEY_REVOKED',
    ],
    ['unknown', [{ keyStatus: 'UNKNOWN' }, {}], 'KEY_1', 'KEY_UNKNOWN'],
    ['suspended', [{}, { keyStatus: 'SUSPENDED' }], 'KEY_2', 'KEY_SUSPENDED'],
    [
      'not activated',
      [{}, { activatedAt: '2026-06-02T00:00:00Z' }],
      'KEY_2',
      'KEY_NOT_ACTIVATED',
    ],
  ])(
    '%s key fails closed with its own reason',
    (_label, patches, keyId, code) => {
      const f = multiKeyFixture(),
        receipt = f.verifier.loadRegistry(signedSnapshot(changedKeys(patches)));
      // Use a fresh verifier so changed genesis is not confused with equivocation.
      const other = createTestOnlyMultiKeyVerifier({
          ...f.context,
          checkpointStore: isolatedTestCheckpointStore(),
        }),
        r = other.loadRegistry(signedSnapshot(changedKeys(patches)));
      const result = other.verifyDocument(
        signedKeyDocument(keyEnvelope(keyId)),
        r,
      );
      expect(result.status).toBe('REJECTED');
      expect(result.diagnosticCodes).toContain(code);
    },
  );
  it.each(['KEY_1', 'KEY_2'])(
    'authority revoked overrides ACTIVE %s',
    (keyId) => {
      const s = multiKeySnapshot(),
        f = multiKeyFixture({
          ...s,
          authorities: [{ ...s.authorities[0], authorityStatus: 'REVOKED' }],
        });
      const r = f.verifier.verifyDocument(
        signedKeyDocument(keyEnvelope(keyId)),
        f.receipt,
      );
      expect(r.status).toBe('REJECTED');
      expect(r.diagnosticCodes).toContain('AUTHORITY_REVOKED');
    },
  );
  it('unregistered key cannot substitute another active key', () => {
    const f = multiKeyFixture(),
      r = f.verifier.verifyDocument(
        signedKeyDocument(keyEnvelope('OTHER_KEY')),
        f.receipt,
      );
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain('KEY_NOT_REGISTERED');
  });
  it('mathematically correct signature does not establish historical signing time', () => {
    const s = multiKeySnapshot(),
      old = {
        ...s.authorities[0].keys[0],
        signingUntil: '2026-05-31T00:00:00Z',
      },
      f = multiKeyFixture({
        ...s,
        authorities: [
          { ...s.authorities[0], keys: [old, s.authorities[0].keys[1]] },
        ],
      });
    const doc = signedKeyDocument(
      keyEnvelope('KEY_1', { claimedSigningTime: '2026-05-01T00:00:00Z' }),
    );
    expect(
      verify(
        null,
        doc.bytes,
        V3_KEY1.publicKey,
        Buffer.from(doc.signatureBase64, 'base64'),
      ),
    ).toBe(true);
    const r = f.verifier.verifyDocument(doc, f.receipt);
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain('AUTHENTICATED_SIGNING_TIME_REQUIRED');
  });
  it.each(['2025-01-01T00:00:00Z', '2026-06-02T00:00:00Z'])(
    'claimed historical/future signing time %s is not a credential',
    (claimedSigningTime) => {
      const f = multiKeyFixture(),
        r = f.verifier.verifyDocument(
          signedKeyDocument(keyEnvelope('KEY_2', { claimedSigningTime })),
          f.receipt,
        );
      expect(r.status).toBe('REJECTED');
      expect(r.diagnosticCodes).toContain('CLAIMED_SIGNING_TIME_INVALID');
    },
  );
  it('payload signing time credential/public key is explicitly refused', () => {
    const f = multiKeyFixture();
    for (const patch of [
      { signingTimeEvidence: { trusted: true } },
      { publicKey: V3_KEY1.publicKey },
    ]) {
      const r = f.verifier.verifyDocument(
        { ...signedKeyDocument(), ...patch },
        f.receipt,
      );
      expect(r.diagnosticCodes).toContain(
        'PAYLOAD_KEY_OR_SIGNING_TIME_CREDENTIAL_REJECTED',
      );
    }
  });
  it('wrong actual signer fails native signature verification', () => {
    const f = multiKeyFixture(),
      r = f.verifier.verifyDocument(
        signedKeyDocument(keyEnvelope('KEY_1'), V3_KEY2),
        f.receipt,
      );
    expect(r.diagnosticCodes).toContain('DOCUMENT_SIGNATURE_INVALID');
  });
  it.each([
    [
      'key ID',
      (s: MultiKeySnapshot) => ({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: [
              s.authorities[0].keys[0],
              { ...s.authorities[0].keys[1], keyId: 'KEY_1' },
            ],
          },
        ],
      }),
      'DUPLICATE_KEY_ID',
    ],
    [
      'key alias',
      (s: MultiKeySnapshot) => ({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: [
              s.authorities[0].keys[0],
              {
                ...s.authorities[0].keys[1],
                publicKeyPem: s.authorities[0].keys[0].publicKeyPem,
                publicKeySha256: s.authorities[0].keys[0].publicKeySha256,
              },
            ],
          },
        ],
      }),
      'SIGNING_IDENTITY_ALIAS_REJECTED',
    ],
    [
      'fingerprint',
      (s: MultiKeySnapshot) => ({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: [
              { ...s.authorities[0].keys[0], publicKeySha256: 'a'.repeat(64) },
            ],
          },
        ],
      }),
      'KEY_PUBLIC_IDENTITY_MISMATCH',
    ],
  ])('duplicate/mismatched %s', (_label, change, reason) => {
    const f = multiKeyFixture(),
      other = createTestOnlyMultiKeyVerifier({
        ...f.context,
        checkpointStore: isolatedTestCheckpointStore(),
      });
    const r = other.loadRegistry(signedSnapshot(change(multiKeySnapshot())));
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain(reason);
  });
  it('wrong criterion/category permissions are denied independently of signature mathematics', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: [
              {
                ...s.authorities[0].keys[0],
                allowedCategories: ['LEGAL_PROOF'],
                allowedCriteria: ['LEGAL_ACCESS'],
              },
              s.authorities[0].keys[1],
            ],
          },
        ],
      });
    const r = f.verifier.verifyDocument(signedKeyDocument(), f.receipt);
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain('KEY_PERMISSION_DENIED');
  });
  it('cross-authority key substitution is not accepted', () => {
    const f = multiKeyFixture(),
      r = f.verifier.verifyDocument(
        signedKeyDocument(
          keyEnvelope('KEY_1', { authorityId: 'OTHER_AUTHORITY' }),
        ),
        f.receipt,
      );
    expect(r.diagnosticCodes).toContain('AUTHORITY_NOT_REGISTERED');
    expect(r.diagnosticCodes).toContain('KEY_NOT_REGISTERED');
  });
});
describe('5C.2D snapshot refresh, rollback and registry compatibility', () => {
  it('new snapshot supersedes old receipts and revalidates current key state', () => {
    const f = multiKeyFixture(),
      doc = signedKeyDocument(),
      receipt = f.verifier.verifyDocument(doc, f.receipt);
    const s2 = nextSnapshot(f, {
      authorities: [
        {
          ...f.snapshot.authorities[0],
          keys: f.snapshot.authorities[0].keys.map((k) =>
            k.keyId === 'KEY_1' ? { ...k, keyStatus: 'REVOKED' } : k,
          ),
        },
      ],
    });
    const r2 = f.verifier.loadRegistry(signedSnapshot(s2));
    expect(r2.status).toBe('VERIFIED_TEST_ONLY');
    expect(
      revalidateMultiKeyDocument(receipt, f.receipt, testClock())
        .diagnosticCodes,
    ).toContain('REGISTRY_RECEIPT_SUPERSEDED_OR_CHECKPOINT_UNAVAILABLE');
    expect(
      revalidateMultiKeyDocument(receipt, r2, testClock()).diagnosticCodes,
    ).toContain('DOCUMENT_RECEIPT_FORGED_OR_CROSS_REGISTRY');
    expect(f.verifier.verifyDocument(doc, r2).diagnosticCodes).toContain(
      'KEY_REVOKED',
    );
    expect(f.verifier.loadRegistry(f.signed).diagnosticCodes).toContain(
      'REGISTRY_SNAPSHOT_ROLLBACK',
    );
  });
  it.each(['equivocation', 'missing previous', 'version gap'])(
    'refresh %s is rejected',
    (fault) => {
      const f = multiKeyFixture();
      const next =
        fault === 'equivocation'
          ? { ...f.snapshot, snapshotId: 'DIFFERENT' }
          : nextSnapshot(
              f,
              fault === 'version gap'
                ? { snapshotVersion: 3 }
                : { previousSnapshotSha256: null },
            );
      const result = f.verifier.loadRegistry(signedSnapshot(next));
      expect(result.status).toBe('REJECTED');
      expect(result.diagnosticCodes).toContain(
        fault === 'equivocation'
          ? 'REGISTRY_SNAPSHOT_EQUIVOCATION'
          : 'REGISTRY_PREVIOUS_SNAPSHOT_MISMATCH',
      );
    },
  );
  it('key ID reuse with different signing identity across refresh is blocked', () => {
    const f = multiKeyFixture(),
      key = {
        ...f.snapshot.authorities[0].keys[0],
        publicKeyPem: V3_KEY2.publicKey
          .export({ type: 'spki', format: 'pem' })
          .toString(),
        publicKeySha256: rawSha256(
          V3_KEY2.publicKey.export({ type: 'spki', format: 'der' }),
        ),
      };
    const r = f.verifier.loadRegistry(
      signedSnapshot(
        nextSnapshot(f, {
          authorities: [{ ...f.snapshot.authorities[0], keys: [key] }],
        }),
      ),
    );
    expect(r.diagnosticCodes).toContain('KEY_ID_REUSE_OR_SUBSTITUTION');
  });
  it('revoked key cannot reactivate in a newer correctly signed snapshot', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: s.authorities[0].keys.map((k) => ({
              ...k,
              keyStatus: 'REVOKED',
            })),
          },
        ],
      });
    const r = f.verifier.loadRegistry(
      signedSnapshot(nextSnapshot(f, { authorities: s.authorities })),
    );
    expect(r.diagnosticCodes).toContain('KEY_REVOCATION_ROLLBACK');
  });
  it.each([
    { schema: 'qualification-test-registry-v2' },
    { schema: 'qualification-test-registry-v4' },
  ])('no legacy/future schema fallback %j', (patch) => {
    const f = multiKeyFixture(),
      r = f.verifier.loadRegistry(signedSnapshot({ ...f.snapshot, ...patch }));
    expect(r.diagnosticCodes).toContain(
      'MULTIKEY_REGISTRY_VERSION_UNSUPPORTED',
    );
  });
  it('actual v2 consumer remains v2 and cannot treat v3 as v2', () => {
    const old = testRegistry();
    expect(old.result.status).toBe('VERIFIED');
    const f = multiKeyFixture(),
      r = f.verifier.loadRegistry({
        bytes: old.config.bytes,
        signatureBase64: old.config.signatureBase64,
      });
    expect(r.status).toBe('REJECTED'); // different root; even a v2 signed by V3_ROOT is refused below
    expect(
      f.verifier.loadRegistry(signedSnapshot({ ...old.data })).diagnosticCodes,
    ).toContain('MULTIKEY_REGISTRY_VERSION_UNSUPPORTED');
    const oldLoader = loadIsolatedTestRegistry(
      {
        ...f.signed,
        rootPublicKey: V3_ROOT.publicKey,
        rootReference: 'TEST_ROOT',
      },
      testClock(),
    );
    expect(oldLoader.diagnosticCodes).toContain(
      'REGISTRY_SCHEMA_VERSION_UNSUPPORTED',
    );
  });
  it('cross-domain/JSON/spread/prototype registry or document receipts fail provenance', () => {
    const f = multiKeyFixture(),
      doc = f.verifier.verifyDocument(signedKeyDocument(), f.receipt),
      other = createTestOnlyMultiKeyVerifier({
        ...f.context,
        domainId: 'OTHER_DOMAIN',
      });
    expect(
      other.verifyDocument(signedKeyDocument(), f.receipt).diagnosticCodes,
    ).toContain('REGISTRY_RECEIPT_FORGED_OR_CROSS_DOMAIN');
    for (const fake of [
      { ...f.receipt },
      JSON.parse(JSON.stringify(f.receipt)),
      Object.create(f.receipt),
    ])
      expect(
        f.verifier.verifyDocument(signedKeyDocument(), fake).diagnosticCodes,
      ).toContain('REGISTRY_RECEIPT_FORGED_OR_CROSS_DOMAIN');
    for (const fake of [
      { ...doc },
      JSON.parse(JSON.stringify(doc)),
      Object.create(doc),
    ])
      expect(
        revalidateMultiKeyDocument(fake, f.receipt, testClock())
          .diagnosticCodes,
      ).toContain('DOCUMENT_RECEIPT_FORGED_OR_CROSS_REGISTRY');
  });
  it.each([
    [
      'stale',
      { revocationCheckedAt: '2026-05-31T20:00:00Z' },
      'REVOCATION_SNAPSHOT_STALE',
    ],
    [
      'expired',
      {
        expiresAt: '2026-05-31T00:00:00Z',
        effectiveAt: '2026-05-30T00:00:00Z',
        createdAt: '2026-05-30T00:00:00Z',
      },
      'REGISTRY_OUTSIDE_EFFECTIVE_PERIOD',
    ],
    [
      'source missing',
      { revocationSourceStatus: 'UNKNOWN' },
      'REVOCATION_SOURCE_UNAVAILABLE',
    ],
  ])('%s signed snapshot cannot become current', (_label, patch, code) => {
    const f = multiKeyFixture();
    const r = f.verifier.loadRegistry(
      signedSnapshot({ ...f.snapshot, ...patch }),
    );
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain(code);
  });
  it('missing snapshot and forged detached signature fail closed', () => {
    const f = multiKeyFixture();
    expect(f.verifier.loadRegistry(null).status).toBe('REJECTED');
    expect(
      f.verifier.loadRegistry({
        ...f.signed,
        signatureBase64: Buffer.alloc(64).toString('base64'),
      }).diagnosticCodes,
    ).toContain('REGISTRY_SIGNATURE_INVALID');
  });
  it('key rotation effective time invalidates a document at final shared evaluation time', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: s.authorities[0].keys.map((k) =>
              k.keyId === 'KEY_1'
                ? { ...k, revokedAt: '2026-06-01T00:00:01Z' }
                : k,
            ),
          },
        ],
      });
    const r = f.verifier.verifyDocument(signedKeyDocument(), f.receipt);
    expect(r.status).toBe('VERIFIED_TEST_ONLY');
    f.setTime('2026-06-01T00:00:02Z');
    expect(
      revalidateMultiKeyDocument(
        r,
        f.receipt,
        isolatedTestClock('2026-06-01T00:00:02Z').read(),
      ).diagnosticCodes,
    ).toContain('KEY_REVOKED');
  });
  it('missing/unavailable checkpoint cannot be treated as empty genesis', () => {
    const f = multiKeyFixture(),
      verifier = createTestOnlyMultiKeyVerifier({
        ...f.context,
        checkpointStore: {
          durability: 'PROCESS_ONLY',
          read: () => ({ status: 'UNAVAILABLE' }),
          compareAndAdvance: () => 'UNAVAILABLE',
        },
      });
    expect(verifier.loadRegistry(f.signed).diagnosticCodes).toContain(
      'TRUSTED_CHECKPOINT_UNAVAILABLE',
    );
  });
  it('a durable-state requirement stays blocked; memory/restart cannot claim durability', () => {
    const f = multiKeyFixture(),
      verifier = createTestOnlyMultiKeyVerifier({
        ...f.context,
        requireDurableCheckpoint: true,
      });
    expect(verifier.loadRegistry(f.signed).diagnosticCodes).toContain(
      'TRUSTED_DURABLE_STATE_UNAVAILABLE',
    );
    const restarted = createTestOnlyMultiKeyVerifier({
      ...f.context,
      checkpointStore: isolatedTestCheckpointStore(),
    });
    // A non-genesis refresh cannot bootstrap from empty trusted state.
    expect(
      restarted.loadRegistry(signedSnapshot(nextSnapshot(f))).diagnosticCodes,
    ).toContain('TRUSTED_BOOTSTRAP_CHECKPOINT_REQUIRED');
  });
  it('clock rollback cannot resurrect a scheduled revoked key', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({
        ...s,
        authorities: [
          {
            ...s.authorities[0],
            keys: s.authorities[0].keys.map((k) => ({
              ...k,
              revokedAt: '2026-06-01T00:00:01Z',
            })),
          },
        ],
      });
    const doc = f.verifier.verifyDocument(signedKeyDocument(), f.receipt);
    expect(
      revalidateMultiKeyDocument(
        doc,
        f.receipt,
        isolatedTestClock('2026-06-01T00:00:02Z').read(),
      ).diagnosticCodes,
    ).toContain('KEY_REVOKED');
    expect(
      revalidateMultiKeyDocument(doc, f.receipt, testClock()).diagnosticCodes,
    ).toContain('CLOCK_ROLLBACK');
  });
  it('missing key lifecycle state cannot default to ACTIVE', () => {
    const f = multiKeyFixture(),
      s = multiKeySnapshot(),
      key: Record<string, unknown> = { ...s.authorities[0].keys[0] };
    delete key.keyStatus;
    const r = f.verifier.loadRegistry(
      signedSnapshot({
        ...s,
        authorities: [{ ...s.authorities[0], keys: [key] }],
      }),
    );
    expect(r.status).toBe('REJECTED');
    expect(r.diagnosticCodes).toContain('KEY_STATUS_REQUIRED');
  });
  it('key activation/version/window cannot be silently rewritten across a refresh', () => {
    const f = multiKeyFixture(),
      s2 = nextSnapshot(f, {
        authorities: [
          {
            ...f.snapshot.authorities[0],
            keys: f.snapshot.authorities[0].keys.map((k) => ({
              ...k,
              signingUntil: '2027-06-01T00:00:00Z',
            })),
          },
        ],
      });
    expect(
      f.verifier.loadRegistry(signedSnapshot(s2)).diagnosticCodes,
    ).toContain('KEY_LIFECYCLE_REWRITE_REJECTED');
  });
  it('document revocation cannot disappear from a new signed snapshot', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({ ...s, revokedDocumentIds: ['DOC_REVOKED'] });
    expect(
      f.verifier.loadRegistry(
        signedSnapshot(nextSnapshot(f, { revokedDocumentIds: [] })),
      ).diagnosticCodes,
    ).toContain('DOCUMENT_REVOCATION_ROLLBACK');
  });
  it('a checkpoint claiming commit without storing its state cannot issue a receipt', () => {
    const f = multiKeyFixture(),
      store = {
        durability: 'PROCESS_ONLY' as const,
        read: () => ({ status: 'EMPTY' as const }),
        compareAndAdvance: () => 'COMMITTED' as const,
      };
    const v = createTestOnlyMultiKeyVerifier({
      ...f.context,
      checkpointStore: store,
    });
    expect(v.loadRegistry(f.signed).diagnosticCodes).toContain(
      'CHECKPOINT_COMMIT_NOT_OBSERVED',
    );
  });
  it('valid root signature on malformed JSON does not become a snapshot', () => {
    const f = multiKeyFixture(),
      bytes = Buffer.from('{');
    expect(
      f.verifier.loadRegistry({
        bytes,
        signatureBase64: sign(null, bytes, V3_ROOT.privateKey).toString(
          'base64',
        ),
      }).status,
    ).toBe('REJECTED');
  });
  it('cross-document reuse of a detached signature fails actual crypto', () => {
    const f = multiKeyFixture(),
      first = signedKeyDocument(),
      other = signedKeyDocument(
        keyEnvelope('KEY_1', { subjectId: 'OTHER_DOCUMENT' }),
      );
    expect(
      f.verifier.verifyDocument(
        { ...other, signatureBase64: first.signatureBase64 },
        f.receipt,
      ).diagnosticCodes,
    ).toContain('DOCUMENT_SIGNATURE_INVALID');
  });
  it.each([
    [
      'old expired/new active',
      [{ signingUntil: '2026-05-31T00:00:00Z' }, {}],
      'KEY_2',
    ],
    ['old revoked/new active', [{ keyStatus: 'REVOKED' }, {}], 'KEY_2'],
    ['new revoked/old active', [{}, { keyStatus: 'REVOKED' }], 'KEY_1'],
    [
      'both revoked',
      [{ keyStatus: 'REVOKED' }, { keyStatus: 'REVOKED' }],
      null,
    ],
  ])(
    '%s: unaffected keys remain usable and denied keys remain denied',
    (_label, patches, acceptedKey) => {
      const f = multiKeyFixture(),
        v = createTestOnlyMultiKeyVerifier({
          ...f.context,
          checkpointStore: isolatedTestCheckpointStore(),
        }),
        registry = v.loadRegistry(signedSnapshot(changedKeys(patches)));
      for (const keyId of ['KEY_1', 'KEY_2']) {
        const out = v.verifyDocument(
          signedKeyDocument(keyEnvelope(keyId)),
          registry,
        );
        expect(out.status).toBe(
          keyId === acceptedKey ? 'VERIFIED_TEST_ONLY' : 'REJECTED',
        );
        const patch = patches[keyId === 'KEY_1' ? 0 : 1];
        const revoked = 'keyStatus' in patch && patch.keyStatus === 'REVOKED';
        expect(out.diagnosticCodes).toContain(
          keyId === acceptedKey
            ? 'NATIVE_DOCUMENT_SIGNATURE'
            : revoked
              ? 'KEY_REVOKED'
              : 'KEY_NOT_AUTHORIZED_FOR_NEW_SIGNATURES',
        );
      }
    },
  );
  it('signed document is bound to its registry and snapshot, with no cross-registry replay', () => {
    const f = multiKeyFixture(),
      other = { ...f.snapshot, registryId: 'OTHER_REGISTRY' },
      otherReceipt = f.verifier.loadRegistry(signedSnapshot(other));
    expect(
      f.verifier.verifyDocument(signedKeyDocument(), otherReceipt)
        .diagnosticCodes,
    ).toContain('DOCUMENT_REGISTRY_SNAPSHOT_MISMATCH');
  });
  it('refresh requires a current-snapshot signature; old bytes are not implicitly migrated', () => {
    const f = multiKeyFixture(),
      r2 = f.verifier.loadRegistry(signedSnapshot(nextSnapshot(f)));
    expect(
      f.verifier.verifyDocument(signedKeyDocument(), r2).diagnosticCodes,
    ).toContain('DOCUMENT_REGISTRY_SNAPSHOT_MISMATCH');
    const fresh = signedKeyDocument(
      keyEnvelope('KEY_2', { snapshotId: 'SNAPSHOT_2' }),
    );
    expect(f.verifier.verifyDocument(fresh, r2).status).toBe(
      'VERIFIED_TEST_ONLY',
    );
  });
  it('scheduled authority revocation cannot be removed by a newer snapshot', () => {
    const s = multiKeySnapshot(),
      f = multiKeyFixture({
        ...s,
        authorities: [
          { ...s.authorities[0], revokedAt: '2026-06-01T00:00:01Z' },
        ],
      });
    const next = nextSnapshot(f, {
      authorities: [{ ...f.snapshot.authorities[0], revokedAt: null }],
    });
    expect(
      f.verifier.loadRegistry(signedSnapshot(next)).diagnosticCodes,
    ).toContain('AUTHORITY_REVOCATION_EVENT_ROLLBACK');
  });
});
