import { generateKeyPairSync, sign } from 'node:crypto';
import {
  createTestOnlyMultiKeyVerifier,
  MultiKeySnapshot,
  MULTIKEY_SCHEMA,
  MULTIKEY_POLICY,
  MULTIKEY_CATEGORIES,
  MultiKeyEnvelope,
} from '../src/qualification-multikey-registry';
import { isolatedTestCheckpointStore } from '../src/qualification-registry-checkpoint';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import { ALL_QUALIFICATION_CRITERIA } from '../src/qualification-types';
import { rawSha256 } from '../src/qualification-verification-json';
import { bytesOf, TEST_NOW } from './qualification-verification-test-fixtures';
import { AuthoritativeProof } from '../src/qualification-proof-types';
import { proofSignedProjection } from '../src/qualification-proof-binding';
export const V3_ROOT = generateKeyPairSync('ed25519'),
  V3_KEY1 = generateKeyPairSync('ed25519'),
  V3_KEY2 = generateKeyPairSync('ed25519'),
  V3_OTHER_KEY = generateKeyPairSync('ed25519');
export function multiKeySnapshot(): MultiKeySnapshot {
  const key = (
    id: string,
    version: number,
    keys: typeof V3_KEY1,
    activatedAt: string,
    replacesKeyId: string | null,
  ) => ({
    keyId: id,
    keyVersion: version,
    algorithm: 'Ed25519' as const,
    publicKeyPem: keys.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString(),
    publicKeySha256: rawSha256(
      keys.publicKey.export({ type: 'spki', format: 'der' }),
    ),
    activatedAt,
    signingUntil: '2027-01-01T00:00:00Z',
    keyStatus: 'ACTIVE' as const,
    revokedAt: null,
    replacesKeyId,
    allowedCategories: [...MULTIKEY_CATEGORIES],
    allowedCriteria: [...ALL_QUALIFICATION_CRITERIA],
  });
  return {
    schema: MULTIKEY_SCHEMA,
    policyVersion: MULTIKEY_POLICY,
    registryId: 'PROOF_REGISTRY',
    snapshotId: 'SNAPSHOT_1',
    snapshotVersion: 1,
    previousSnapshotSha256: null,
    createdAt: TEST_NOW,
    effectiveAt: TEST_NOW,
    expiresAt: '2026-06-01T04:00:00Z',
    revocationCheckedAt: TEST_NOW,
    revocationSourceStatus: 'AVAILABLE',
    rotationPolicy: 'ALLOW_EXPLICIT_OVERLAP',
    revokedDocumentIds: [],
    authorities: [
      {
        authorityId: 'PROOF_AUTHORITY',
        name: 'ISOLATED PROOF AUTHORITY',
        authorityStatus: 'ACTIVE',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2028-01-01T00:00:00Z',
        revokedAt: null,
        allowedCategories: [...MULTIKEY_CATEGORIES],
        allowedCriteria: [...ALL_QUALIFICATION_CRITERIA],
        keys: [
          key('KEY_1', 1, V3_KEY1, '2026-01-01T00:00:00Z', null),
          key('KEY_2', 2, V3_KEY2, '2026-05-01T00:00:00Z', 'KEY_1'),
        ],
      },
    ],
  };
}
export function signedSnapshot(data: unknown) {
  const bytes = bytesOf(data);
  return {
    bytes,
    signatureBase64: sign(null, bytes, V3_ROOT.privateKey).toString('base64'),
  };
}
export function keyEnvelope(
  keyId = 'KEY_1',
  patch: Partial<MultiKeyEnvelope> = {},
): MultiKeyEnvelope {
  return {
    registryId: 'PROOF_REGISTRY',
    snapshotId: 'SNAPSHOT_1',
    schema: 'qualification-multikey-document-v1',
    subjectId: 'TEST_DOCUMENT',
    authorityId: 'PROOF_AUTHORITY',
    keyId,
    category: 'EVIDENCE',
    criterion: 'STRUCTURAL_LOAD_CAPACITY',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    claimedSigningTime: null,
    body: { testOnly: true },
    ...patch,
  };
}
export function signedKeyDocument(
  envelope = keyEnvelope(),
  signer = envelope.keyId === 'KEY_2' ? V3_KEY2 : V3_KEY1,
) {
  const bytes = bytesOf(envelope);
  return {
    bytes,
    signatureBase64: sign(null, bytes, signer.privateKey).toString('base64'),
    algorithm: 'Ed25519' as const,
    keyId: envelope.keyId,
    authorityId: envelope.authorityId,
  };
}
export function multiKeyFixture(
  snapshot: MultiKeySnapshot = multiKeySnapshot(),
) {
  let time = TEST_NOW;
  const store = isolatedTestCheckpointStore();
  const context = {
    scope: 'TEST_ONLY' as const,
    domainId: 'ISOLATED_PROOF_TEST',
    rootPublicKey: V3_ROOT.publicKey,
    rootReference: 'ISOLATED_ROOT',
    clock: { read: () => isolatedTestClock(time).read() },
    checkpointStore: store,
    requireDurableCheckpoint: false,
  };
  const verifier = createTestOnlyMultiKeyVerifier(context),
    signed = signedSnapshot(snapshot),
    receipt = verifier.loadRegistry(signed);
  return {
    context,
    store,
    snapshot,
    signed,
    verifier,
    receipt,
    setTime: (next: string) => {
      time = next;
    },
  };
}
export function signProofPacket<T extends AuthoritativeProof>(
  proof: T,
  fixture: ReturnType<typeof multiKeyFixture>,
  signer = V3_KEY1,
) {
  const envelope = keyEnvelope(proof.document.keyId, {
    registryId: proof.document.registryId,
    snapshotId: proof.document.snapshotId,
    subjectId: proof.document.documentId,
    category: proof.document.category,
    criterion: proof.criterion,
    validFrom: proof.validFrom,
    validUntil: proof.validUntil,
    body: { proof: proofSignedProjection(proof) },
  });
  const document = signedKeyDocument(envelope, signer),
    updated = {
      ...proof,
      document: { ...proof.document, sha256: rawSha256(document.bytes) },
    };
  return {
    proof: updated,
    documentBytes: document.bytes,
    documentReceipt: fixture.verifier.verifyDocument(document, fixture.receipt),
    document,
  };
}
