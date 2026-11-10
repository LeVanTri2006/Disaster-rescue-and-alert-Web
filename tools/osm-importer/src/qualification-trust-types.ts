/** Verification observations are not qualification certificates. No production
 * authority roots/clock/registry are configured in this foundation.
 */
export const VERIFICATION_POLICY_VERSION =
  'qualification-verification-5C2C-v2' as const;
export type DocumentCategory =
  'GRAPH_MANIFEST' | 'EVIDENCE' | 'EXEMPTION' | 'PROFILE_APPROVAL';
export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'UNTRUSTED_ISSUER'
  | 'VERIFIER_UNAVAILABLE';
export type VerificationScope =
  'TECHNICAL_ONLY' | 'TEST_ONLY' | 'UNCONFIGURED_PRODUCTION';
export interface VerificationMetadata {
  readonly verificationType: string;
  readonly subjectId: string;
  readonly artifactIdentity: {
    readonly sha256?: string;
    readonly version?: string;
    readonly representation?: string;
  };
  readonly policyVersion: typeof VERIFICATION_POLICY_VERSION;
  readonly verificationTimestamp: string | null;
  readonly trustSourceReference: string | null;
  readonly method: string;
  readonly keyId?: string;
  readonly scope: VerificationScope;
  readonly productionAuthoritative: false;
  readonly qualificationEligible: false;
}
export type VerificationResult<T> = Readonly<
  VerificationMetadata &
    (
      | {
          readonly status: 'VERIFIED';
          readonly verificationTimestamp: string;
          readonly trustSourceReference: string;
          readonly scope: 'TECHNICAL_ONLY' | 'TEST_ONLY';
          readonly assurance:
            | 'SIGNATURE_MATHEMATICS'
            | 'TEST_REGISTRY_AUTHENTICITY'
            | 'TEST_DOCUMENT_AUTHENTICITY'
            | 'TEST_BYTE_INTEGRITY'
            | 'TEST_IDENTITY_BINDING'
            | 'TEST_VALIDITY';
          readonly details: T;
          readonly diagnosticCodes: readonly string[];
        }
      | {
          readonly status: Exclude<VerificationStatus, 'VERIFIED'>;
          readonly assurance: 'NONE';
          readonly details?: T;
          readonly diagnosticCodes: readonly string[];
        }
    )
>;
/** Public failure constructor cannot mint VERIFIED. Success is issued locally
 * by verifiers; modules accepting receipts also check private WeakMap provenance.
 */
export function failure<T = never>(
  metadata: VerificationMetadata,
  status: Exclude<VerificationStatus, 'VERIFIED'>,
  codes: readonly string[],
  details?: T,
): Extract<
  VerificationResult<T>,
  { readonly status: Exclude<VerificationStatus, 'VERIFIED'> }
> {
  const allowed = [
    'UNVERIFIED',
    'INVALID',
    'EXPIRED',
    'REVOKED',
    'UNTRUSTED_ISSUER',
    'VERIFIER_UNAVAILABLE',
  ];
  const safeStatus = allowed.includes(status) ? status : 'INVALID';
  return Object.freeze({
    ...metadata,
    artifactIdentity: Object.freeze({ ...metadata.artifactIdentity }),
    status: safeStatus,
    assurance: 'NONE',
    productionAuthoritative: false,
    qualificationEligible: false,
    diagnosticCodes: Object.freeze([...new Set(codes)].sort()),
    ...(details === undefined ? {} : { details }),
  });
}
export function metadata(
  type: string,
  subjectId: string,
  timestamp: string | null = null,
  source: string | null = null,
  scope: VerificationScope = 'UNCONFIGURED_PRODUCTION',
): VerificationMetadata {
  return {
    verificationType: type,
    subjectId,
    artifactIdentity: {},
    policyVersion: VERIFICATION_POLICY_VERSION,
    verificationTimestamp: timestamp,
    trustSourceReference: source,
    method: 'NOT_CONFIGURED',
    scope,
    productionAuthoritative: false,
    qualificationEligible: false,
  };
}
