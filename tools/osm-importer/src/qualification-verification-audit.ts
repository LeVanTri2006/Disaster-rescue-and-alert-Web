import {
  VERIFICATION_POLICY_VERSION,
  VerificationResult,
} from './qualification-trust-types';
import { rawSha256 } from './qualification-verification-json';
import {
  PipelineState,
  VerificationAuditStep,
} from './qualification-verification-pipeline-types';

export function auditStep(
  stepId: string,
  status: VerificationAuditStep['status'],
  codes: readonly string[],
  timestamp: string | null,
  dependencyReferences: readonly string[] = [],
  verificationType = stepId,
  subjectIdentity = stepId,
  inputReference = `claim:${stepId}`,
): VerificationAuditStep {
  return {
    stepId,
    status,
    diagnosticCodes: [...new Set(codes)].sort(),
    timestamp,
    dependencyReferences,
    verificationType,
    subjectIdentity,
    inputReference,
    resultReference: `audit:${stepId}`,
    scope: 'TEST_ONLY',
    policyVersion: VERIFICATION_POLICY_VERSION,
  };
}
export function receiptAudit(
  stepId: string,
  receipt: VerificationResult<unknown>,
  dependencies: readonly string[],
): VerificationAuditStep {
  // Subject references are hashes/indices supplied by the orchestrator, rather
  // than copying arbitrary caller identifiers or verifier error messages.
  return auditStep(
    stepId,
    receipt.status,
    receipt.diagnosticCodes,
    receipt.verificationTimestamp,
    dependencies,
    receipt.verificationType,
    `subject-sha256:${rawSha256(Buffer.from(receipt.subjectId))}`,
    receipt.artifactIdentity.sha256
      ? `sha256:${receipt.artifactIdentity.sha256}`
      : `claim:${stepId}`,
  );
}
/** Explicit precedence. BLOCKED steps preserve upstream reasons without
 * downgrading a known rejection into a missing-data result. */
export function finalState(
  audit: readonly VerificationAuditStep[],
): PipelineState {
  if (
    audit.some((s) =>
      ['INVALID', 'EXPIRED', 'REVOKED', 'UNTRUSTED_ISSUER'].includes(s.status),
    )
  )
    return 'REJECTED';
  if (audit.some((s) => s.status === 'VERIFIER_UNAVAILABLE'))
    return 'VERIFIER_UNAVAILABLE';
  if (
    audit.some((s) =>
      ['UNVERIFIED', 'BLOCKED', 'INCOMPLETE'].includes(s.status),
    )
  )
    return 'INCOMPLETE';
  return audit.length ? 'VERIFIED_TEST_ONLY' : 'NOT_STARTED';
}
