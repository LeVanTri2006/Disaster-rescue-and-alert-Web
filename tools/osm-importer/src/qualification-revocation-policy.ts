/** Snapshot policy in the isolated test domain; no live CRL/OCSP provider. */
import {
  inspectTestRegistryReceipt,
  AuthorityEntry,
} from './qualification-authority-registry';
import { inspectClock, verifyValidity } from './qualification-trusted-clock';
import {
  failure,
  metadata,
  VerificationResult,
  VerificationStatus,
} from './qualification-trust-types';
import { immutableJson } from './qualification-verification-json';
import { isNonEmptyString } from './qualification-validation';

export const REVOCATION_POLICY_VERSION =
  'qualification-test-revocation-v1' as const;
export const LIFECYCLE_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
  'UNKNOWN',
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export interface RevocationFacet {
  readonly status: LifecycleStatus | 'MISSING' | 'UNAVAILABLE';
  readonly verificationStatus: VerificationStatus;
  readonly diagnosticCodes: readonly string[];
}
export interface RevocationDetails {
  readonly registry: RevocationFacet;
  readonly authority: RevocationFacet;
  readonly key: RevocationFacet;
  readonly document: RevocationFacet;
  readonly snapshotId: string | null;
  readonly registrySha256: string | null;
  readonly revocationPolicyVersion: typeof REVOCATION_POLICY_VERSION;
  readonly authorityEntry: AuthorityEntry | null;
}
function facet(
  status: RevocationFacet['status'],
  verificationStatus: VerificationStatus,
  codes: string[],
): RevocationFacet {
  return { status, verificationStatus, diagnosticCodes: codes };
}
function lifecycle(
  prefix: 'AUTHORITY' | 'KEY',
  status: LifecycleStatus,
  from: string,
  until: string,
  revokedAt: string | undefined,
  reading: unknown,
): RevocationFacet {
  const clock = inspectClock(reading);
  const effective =
    revokedAt &&
    clock?.timestamp &&
    Date.parse(clock.timestamp) >= Date.parse(revokedAt)
      ? 'REVOKED'
      : status;
  const reasons = [`${prefix}_${effective}`];
  const window = verifyValidity(
    { validFrom: from, validUntil: until, revocationStatus: 'ACTIVE' },
    reading,
  );
  if (effective === 'REVOKED' || effective === 'SUSPENDED')
    return facet(effective, 'REVOKED', [
      ...reasons,
      ...window.diagnosticCodes.filter((c) => c !== 'TEST_TIME_ONLY'),
    ]);
  if (effective === 'UNKNOWN')
    return facet('UNKNOWN', 'VERIFIER_UNAVAILABLE', [
      ...reasons,
      `${prefix}_STATUS_UNKNOWN`,
      'REVOCATION_SOURCE_UNAVAILABLE',
    ]);
  if (effective === 'EXPIRED' || window.status === 'EXPIRED')
    return facet('EXPIRED', 'EXPIRED', [...reasons, `${prefix}_EXPIRED`]);
  if (window.status !== 'VERIFIED')
    return facet(effective, window.status, [
      ...reasons,
      ...window.diagnosticCodes,
    ]);
  return facet('ACTIVE', 'VERIFIED', reasons);
}
/** Only a registry in the private loader WeakMap can supply lifecycle facts.
 * Neither this result nor a caller-supplied status object is an input credential. */
export function evaluateTestRevocation(
  registry: unknown,
  reading: unknown,
  authorityId: string,
  keyId: string,
  subjectId: string,
): VerificationResult<RevocationDetails> {
  const clock = inspectClock(reading),
    state = inspectTestRegistryReceipt(registry);
  const meta = {
    ...metadata(
      'INDEPENDENT_REVOCATION',
      isNonEmptyString(subjectId) ? subjectId : 'INVALID_SUBJECT',
      clock?.timestamp ?? null,
      state ? `TEST_REGISTRY:${state.version}:${state.hash}` : null,
      'TEST_ONLY',
    ),
    method: REVOCATION_POLICY_VERSION,
  };
  const unavailable = () =>
    facet('UNAVAILABLE', 'VERIFIER_UNAVAILABLE', [
      'REVOCATION_SOURCE_UNAVAILABLE',
    ]);
  let registryFacet = unavailable(),
    authority = unavailable(),
    key = unavailable(),
    document = unavailable();
  let entry: AuthorityEntry | null = null;
  if (!state)
    registryFacet = facet('UNAVAILABLE', 'VERIFIER_UNAVAILABLE', [
      'REGISTRY_UNAVAILABLE_OR_FORGED',
      'REVOCATION_SOURCE_UNAVAILABLE',
    ]);
  else {
    const window = verifyValidity(
      {
        validFrom: state.validFrom,
        validUntil: state.validUntil,
        revocationStatus: 'ACTIVE',
      },
      reading,
    );
    const age = clock?.timestamp
      ? Date.parse(clock.timestamp) - Date.parse(state.revocationCheckedAt)
      : Infinity;
    if (!clock || clock.kind !== 'TEST_ONLY' || !clock.timestamp)
      registryFacet = facet('UNAVAILABLE', 'VERIFIER_UNAVAILABLE', [
        'TEST_CLOCK_REQUIRED',
      ]);
    else if (state.revocationPolicyVersion !== REVOCATION_POLICY_VERSION)
      registryFacet = facet('UNAVAILABLE', 'INVALID', [
        'REVOCATION_POLICY_MISMATCH',
      ]);
    else if (state.revocationSourceStatus !== 'AVAILABLE')
      registryFacet = unavailable();
    else if (window.status !== 'VERIFIED')
      registryFacet = facet('EXPIRED', window.status, [
        ...window.diagnosticCodes,
      ]);
    else if (age < 0 || age > 3600000)
      registryFacet = facet('UNAVAILABLE', 'VERIFIER_UNAVAILABLE', [
        'REVOCATION_SNAPSHOT_STALE',
        'REGISTRY_REVOCATION_SNAPSHOT_STALE',
      ]);
    else
      registryFacet = facet('ACTIVE', 'VERIFIED', [
        'AUTHENTIC_SIGNED_REVOCATION_SNAPSHOT',
      ]);
    const knownAuthority = state.entries.find(
      (e) => e.authorityId === authorityId,
    );
    entry = knownAuthority?.keyId === keyId ? knownAuthority : null;
    authority = knownAuthority
      ? lifecycle(
          'AUTHORITY',
          knownAuthority.authorityStatus,
          knownAuthority.validFrom,
          knownAuthority.validUntil,
          knownAuthority.authorityRevokedAt,
          reading,
        )
      : facet('MISSING', 'UNTRUSTED_ISSUER', [
          'AUTHORITY_NOT_REGISTERED',
          'AUTHORITY_OR_KEY_NOT_REGISTERED',
        ]);
    if (!entry)
      key = facet('MISSING', 'UNTRUSTED_ISSUER', [
        'KEY_NOT_REGISTERED',
        'AUTHORITY_OR_KEY_NOT_REGISTERED',
      ]);
    else {
      key = lifecycle(
        'KEY',
        entry.keyStatus,
        entry.keyValidFrom,
        entry.keyValidUntil,
        entry.keyRevokedAt,
        reading,
      );
      if (
        clock?.timestamp &&
        Date.parse(clock.timestamp) > Date.parse(entry.certificateValidUntil)
      )
        key = facet(
          key.verificationStatus === 'REVOKED' ? key.status : 'EXPIRED',
          key.verificationStatus === 'REVOKED' ? 'REVOKED' : 'EXPIRED',
          [
            ...key.diagnosticCodes,
            'KEY_CERTIFICATE_METADATA_EXPIRED',
            'TEST_CERTIFICATE_METADATA_EXPIRED',
          ],
        );
    }
    document = !isNonEmptyString(subjectId)
      ? facet('MISSING', 'INVALID', ['REVOCATION_SUBJECT_INVALID'])
      : state.revokedDocumentIds.includes(subjectId)
        ? facet('REVOKED', 'REVOKED', ['DOCUMENT_REVOKED_BY_REGISTRY'])
        : facet('ACTIVE', 'VERIFIED', [
            'DOCUMENT_NOT_REVOKED_IN_SIGNED_SNAPSHOT',
          ]);
  }
  const details = immutableJson({
    registry: registryFacet,
    authority,
    key,
    document,
    snapshotId: state?.revocationSnapshotId ?? null,
    registrySha256: state?.hash ?? null,
    revocationPolicyVersion: REVOCATION_POLICY_VERSION,
    authorityEntry: entry,
  });
  const statuses = [registryFacet, authority, key, document].map(
    (f) => f.verificationStatus,
  );
  const codes = [
    ...new Set(
      [registryFacet, authority, key, document].flatMap(
        (f) => f.diagnosticCodes,
      ),
    ),
  ].sort();
  for (const rejected of [
    'INVALID',
    'REVOKED',
    'EXPIRED',
    'UNTRUSTED_ISSUER',
    'VERIFIER_UNAVAILABLE',
    'UNVERIFIED',
  ] as const)
    if (statuses.includes(rejected))
      return failure(meta, rejected, codes, details);
  if (!clock?.timestamp || !state)
    return failure(
      meta,
      'VERIFIER_UNAVAILABLE',
      ['REVOCATION_SOURCE_UNAVAILABLE'],
      details,
    );
  return Object.freeze({
    ...meta,
    status: 'VERIFIED',
    scope: 'TEST_ONLY',
    verificationTimestamp: clock.timestamp,
    trustSourceReference: `TEST_REGISTRY:${state.version}:${state.hash}`,
    assurance: 'TEST_REGISTRY_AUTHENTICITY',
    details,
    diagnosticCodes: Object.freeze(codes),
  });
}
