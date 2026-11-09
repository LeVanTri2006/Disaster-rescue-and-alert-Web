import { KeyObject, createPublicKey, verify } from 'node:crypto';
import {
  ALL_QUALIFICATION_CRITERIA,
  QualificationCriterion,
} from './qualification-types';
import {
  isNonEmptyString,
  isObject,
  isValidIsoTimestamp,
} from './qualification-validation';
import {
  DocumentCategory,
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';
import {
  immutableJson,
  parseJsonBytes,
  rawSha256,
  strictBase64,
} from './qualification-verification-json';
import {
  evaluateTestRevocation,
  LifecycleStatus,
  LIFECYCLE_STATUSES,
  REVOCATION_POLICY_VERSION,
} from './qualification-revocation-policy';
import { inspectClock, verifyValidity } from './qualification-trusted-clock';

export interface AuthorityEntry {
  readonly authorityId: string;
  readonly name: string;
  readonly role: 'TEST_AUTHORITY';
  readonly allowedCriteria: readonly QualificationCriterion[];
  readonly allowedCategories: readonly DocumentCategory[];
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly algorithm: 'Ed25519';
  readonly validFrom: string;
  readonly validUntil: string;
  readonly certificateId: string;
  /** Signed test registry metadata, NOT an X.509 chain verification. */
  readonly certificateValidUntil: string;
  readonly authorityStatus: LifecycleStatus;
  readonly keyStatus: LifecycleStatus;
  readonly keyValidFrom: string;
  readonly keyValidUntil: string;
  /** Signed scheduled test events; not live revocation monitoring. */
  readonly authorityRevokedAt?: string;
  readonly keyRevokedAt?: string;
}
export interface RegistryDetails {
  readonly registryVersion: string;
  readonly registrySha256: string;
  readonly authorityCount: number;
  readonly contractVersion: 'qualification-test-registry-v2';
  readonly revocationPolicyVersion: typeof REVOCATION_POLICY_VERSION;
  readonly revocationSnapshotId: string;
}
export interface RegistryState {
  readonly entries: readonly AuthorityEntry[];
  readonly version: string;
  readonly hash: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly revocationCheckedAt: string;
  readonly revokedDocumentIds: readonly string[];
  readonly revocationPolicyVersion: typeof REVOCATION_POLICY_VERSION;
  readonly revocationSnapshotId: string;
  readonly revocationSourceStatus: 'AVAILABLE' | 'UNAVAILABLE';
}
const registries = new WeakMap<object, RegistryState>();
const categories = [
  'GRAPH_MANIFEST',
  'EVIDENCE',
  'EXEMPTION',
  'PROFILE_APPROVAL',
];
function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  );
}
export function productionAuthorityRegistry(): VerificationResult<RegistryDetails> {
  return failure(
    metadata('AUTHORITY_REGISTRY', 'production-registry'),
    'VERIFIER_UNAVAILABLE',
    ['PRODUCTION_REGISTRY_AND_TRUST_ROOTS_NOT_CONFIGURED'],
  );
}
/** Only isolated TEST_ONLY roots are accepted here. Roots are out-of-band test
 * configuration, not keys embedded in the document being authenticated.
 * There is intentionally no production registry loader in this task.
 */
export function loadIsolatedTestRegistry(
  input: {
    readonly bytes: Uint8Array;
    readonly signatureBase64: string;
    readonly rootPublicKey: KeyObject;
    readonly rootReference: string;
  },
  reading: unknown,
): VerificationResult<RegistryDetails> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'AUTHORITY_REGISTRY',
        'isolated-test-registry',
        clock?.timestamp ?? null,
        isObject(input) && typeof input.rootReference === 'string'
          ? input.rootReference
          : null,
        'TEST_ONLY',
      ),
      method: 'ED25519_SIGNED_TEST_REGISTRY',
    };
  try {
    if (!isObject(input))
      return failure(meta, 'INVALID', ['REGISTRY_REQUEST_INVALID']);
    if (!clock || clock.kind !== 'TEST_ONLY' || !clock.timestamp)
      return failure(meta, 'VERIFIER_UNAVAILABLE', ['TEST_CLOCK_REQUIRED']);
    if (
      !(input.rootPublicKey instanceof KeyObject) ||
      input.rootPublicKey.type !== 'public' ||
      input.rootPublicKey.asymmetricKeyType !== 'ed25519' ||
      !isNonEmptyString(input.rootReference)
    )
      return failure(meta, 'UNTRUSTED_ISSUER', ['TEST_ROOT_INVALID']);
    if (!(input.bytes instanceof Uint8Array))
      return failure(meta, 'INVALID', ['REGISTRY_BYTES_MISSING']);
    const bytes = Buffer.from(input.bytes),
      signature = strictBase64(input.signatureBase64);
    if (
      !signature ||
      signature.length !== 64 ||
      !verify(null, bytes, input.rootPublicKey, signature)
    )
      return failure(meta, 'INVALID', ['REGISTRY_SIGNATURE_INVALID']);
    const data = parseJsonBytes(bytes, true);
    if (isObject(data) && data.schema !== 'qualification-test-registry-v2')
      return failure(meta, 'INVALID', ['REGISTRY_SCHEMA_VERSION_UNSUPPORTED']);
    if (
      isObject(data) &&
      data.revocationPolicyVersion !== REVOCATION_POLICY_VERSION
    )
      return failure(meta, 'INVALID', ['REVOCATION_POLICY_MISMATCH']);
    if (
      !isObject(data) ||
      data.schema !== 'qualification-test-registry-v2' ||
      !isNonEmptyString(data.registryVersion) ||
      !isNonEmptyString(data.revocationSnapshotId) ||
      !['AVAILABLE', 'UNAVAILABLE'].includes(
        String(data.revocationSourceStatus),
      ) ||
      !isValidIsoTimestamp(data.validFrom) ||
      !isValidIsoTimestamp(data.validUntil) ||
      !isValidIsoTimestamp(data.revocationCheckedAt) ||
      !strings(data.revokedDocumentIds) ||
      !Array.isArray(data.authorities)
    )
      return failure(meta, 'INVALID', ['REGISTRY_SCHEMA_INVALID']);
    const window = verifyValidity(
      {
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        revocationStatus: 'ACTIVE',
      },
      reading,
    );
    if (window.status !== 'VERIFIED')
      return failure(meta, window.status, window.diagnosticCodes);
    const age =
      Date.parse(clock.timestamp) - Date.parse(data.revocationCheckedAt);
    if (age < 0 || age > 3600000)
      return failure(meta, 'VERIFIER_UNAVAILABLE', [
        'REGISTRY_REVOCATION_SNAPSHOT_STALE',
        'REVOCATION_SNAPSHOT_STALE',
      ]);
    if (data.revocationSourceStatus !== 'AVAILABLE')
      return failure(meta, 'VERIFIER_UNAVAILABLE', [
        'REVOCATION_SOURCE_UNAVAILABLE',
      ]);
    const entries: AuthorityEntry[] = [],
      authorityIds = new Set<string>(),
      keyIds = new Set<string>();
    for (const raw of data.authorities) {
      const lifecycleErrors: string[] = [];
      if (isObject(raw)) {
        for (const [field, prefix] of [
          ['authorityStatus', 'AUTHORITY'],
          ['keyStatus', 'KEY'],
        ] as const)
          if (!LIFECYCLE_STATUSES.some((s) => s === raw[field]))
            lifecycleErrors.push(
              `${prefix}_STATUS_${raw[field] === undefined ? 'MISSING' : 'INVALID'}`,
            );
        if ('revocationStatus' in raw)
          lifecycleErrors.push('LEGACY_COMBINED_REVOCATION_FIELD_REJECTED');
      }
      if (lifecycleErrors.length)
        return failure(meta, 'INVALID', lifecycleErrors);
      if (
        !isObject(raw) ||
        !['authorityId', 'name', 'keyId', 'certificateId'].every((k) =>
          isNonEmptyString(raw[k]),
        ) ||
        typeof raw.publicKeyPem !== 'string' ||
        !raw.publicKeyPem.trim() ||
        raw.role !== 'TEST_AUTHORITY' ||
        raw.algorithm !== 'Ed25519' ||
        !strings(raw.allowedCriteria) ||
        !raw.allowedCriteria.every((c) =>
          ALL_QUALIFICATION_CRITERIA.some((x) => x === c),
        ) ||
        !strings(raw.allowedCategories) ||
        !raw.allowedCategories.length ||
        !raw.allowedCategories.every((c) => categories.includes(c)) ||
        !isValidIsoTimestamp(raw.validFrom) ||
        !isValidIsoTimestamp(raw.validUntil) ||
        !isValidIsoTimestamp(raw.certificateValidUntil) ||
        !isValidIsoTimestamp(raw.keyValidFrom) ||
        !isValidIsoTimestamp(raw.keyValidUntil) ||
        (raw.authorityRevokedAt !== undefined &&
          !isValidIsoTimestamp(raw.authorityRevokedAt)) ||
        (raw.keyRevokedAt !== undefined &&
          !isValidIsoTimestamp(raw.keyRevokedAt))
      )
        return failure(meta, 'INVALID', ['AUTHORITY_SCHEMA_INVALID']);
      if (
        Date.parse(raw.validFrom) > Date.parse(raw.validUntil) ||
        Date.parse(raw.keyValidFrom) > Date.parse(raw.keyValidUntil)
      )
        return failure(meta, 'INVALID', ['AUTHORITY_PERIOD_INVALID']);
      const authorityId = raw.authorityId as string,
        keyId = raw.keyId as string;
      if (authorityIds.has(authorityId))
        return failure(meta, 'INVALID', ['DUPLICATE_AUTHORITY_ID']);
      if (keyIds.has(keyId))
        return failure(meta, 'INVALID', ['DUPLICATE_KEY_ID']);
      const key = createPublicKey(raw.publicKeyPem as string);
      if (key.asymmetricKeyType !== 'ed25519')
        return failure(meta, 'INVALID', ['AUTHORITY_KEY_ALGORITHM_MISMATCH']);
      authorityIds.add(authorityId);
      keyIds.add(keyId);
      // Exhaustive schema checked; snapshot detached from caller objects.
      entries.push(raw as unknown as AuthorityEntry);
    }
    const hash = rawSha256(bytes),
      details = Object.freeze({
        registryVersion: data.registryVersion,
        registrySha256: hash,
        authorityCount: entries.length,
        contractVersion: 'qualification-test-registry-v2' as const,
        revocationPolicyVersion: REVOCATION_POLICY_VERSION,
        revocationSnapshotId: data.revocationSnapshotId,
      });
    const result: VerificationResult<RegistryDetails> = Object.freeze({
      ...meta,
      artifactIdentity: Object.freeze({
        sha256: hash,
        version: data.registryVersion,
      }),
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      verificationTimestamp: clock.timestamp,
      trustSourceReference: input.rootReference,
      assurance: 'TEST_REGISTRY_AUTHENTICITY',
      details,
      diagnosticCodes: Object.freeze([
        'ISOLATED_TEST_ROOT_ONLY',
        'NO_PRODUCTION_PKI',
      ]),
    });
    registries.set(
      result,
      immutableJson({
        entries,
        version: data.registryVersion,
        hash,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        revocationCheckedAt: data.revocationCheckedAt,
        revokedDocumentIds: data.revokedDocumentIds,
        revocationPolicyVersion: REVOCATION_POLICY_VERSION,
        revocationSnapshotId: data.revocationSnapshotId,
        revocationSourceStatus: 'AVAILABLE' as const,
      }),
    );
    return result;
  } catch {
    return failure(meta, 'INVALID', ['REGISTRY_PARSE_OR_CRYPTO_ERROR']);
  }
}
export function authorizeTestAuthority(
  registry: unknown,
  reading: unknown,
  authorityId: string,
  keyId: string,
  category: DocumentCategory,
  criterion: QualificationCriterion | null,
  subjectId: string,
): VerificationResult<AuthorityEntry> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'AUTHORITY_AUTHORIZATION',
        authorityId,
        clock?.timestamp ?? null,
        null,
        'TEST_ONLY',
      ),
      method: 'SIGNED_TEST_REGISTRY_LOOKUP',
      keyId,
    };
  const state =
    registry !== null && typeof registry === 'object'
      ? registries.get(registry)
      : undefined;
  if (!state)
    return failure(meta, 'VERIFIER_UNAVAILABLE', [
      'REGISTRY_UNAVAILABLE_OR_FORGED',
    ]);
  if (!clock || clock.kind !== 'TEST_ONLY' || !clock.timestamp)
    return failure(meta, 'VERIFIER_UNAVAILABLE', ['TEST_CLOCK_REQUIRED']);
  const revocation = evaluateTestRevocation(
    registry,
    reading,
    authorityId,
    keyId,
    subjectId,
  );
  if (revocation.status !== 'VERIFIED')
    return failure(meta, revocation.status, revocation.diagnosticCodes);
  const authority = revocation.details.authorityEntry;
  if (!authority)
    return failure(meta, 'UNTRUSTED_ISSUER', [
      'AUTHORITY_OR_KEY_NOT_REGISTERED',
    ]);
  if (
    !authority.allowedCategories.includes(category) ||
    (criterion !== null && !authority.allowedCriteria.includes(criterion))
  )
    return failure(meta, 'UNTRUSTED_ISSUER', ['AUTHORITY_SCOPE_DENIED']);
  return Object.freeze({
    ...meta,
    trustSourceReference: `TEST_REGISTRY:${state.version}:${state.hash}`,
    verificationTimestamp: clock.timestamp,
    status: 'VERIFIED',
    scope: 'TEST_ONLY',
    assurance: 'TEST_REGISTRY_AUTHENTICITY',
    details: authority,
    diagnosticCodes: Object.freeze([
      'TEST_AUTHORITY_ONLY',
      'X509_CHAIN_NOT_VERIFIED',
    ]),
  });
}

/** Provenance lookup only. Consumers must evaluate time/lifecycle before use. */
export function inspectTestRegistryReceipt(
  receipt: unknown,
): RegistryState | undefined {
  return receipt !== null && typeof receipt === 'object'
    ? registries.get(receipt)
    : undefined;
}
