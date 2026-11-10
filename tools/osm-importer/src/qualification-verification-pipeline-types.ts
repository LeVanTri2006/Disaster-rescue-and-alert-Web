/** Claimed inputs and audit summaries are never runtime verification receipts. */
import { KeyObject } from 'node:crypto';
import { ClockProvider } from './qualification-trusted-clock';
import { DetachedDocumentInput } from './qualification-crypto-verifier';
import { EdgeIdentityBinding } from './qualification-identity-binding';
import {
  EdgeQualificationRecord,
  QualificationCriterion,
} from './qualification-types';
import {
  ExemptionDecision,
  ExemptionDecisionState,
} from './qualification-exemption-policy';
import { RevocationFacet } from './qualification-revocation-policy';
import { VerificationStatus } from './qualification-trust-types';

export interface TestVerificationContext {
  readonly scope: 'TEST_ONLY';
  readonly rootPublicKey: KeyObject;
  readonly rootReference: string;
  readonly clock: ClockProvider;
}
export interface ClaimedRecordDocument {
  readonly record: unknown;
  readonly document: DetachedDocumentInput;
}
export interface VerificationPipelineRequest {
  readonly mode: 'TEST_ONLY';
  readonly evaluatedAt: string;
  readonly registry: {
    readonly bytes: Uint8Array;
    readonly signatureBase64: string;
  };
  readonly manifest: DetachedDocumentInput;
  readonly graph: {
    readonly bytes: Uint8Array;
    readonly representation: 'JSON' | 'JSON.GZ';
    readonly claimedDigest?: string;
    readonly claimedVersion?: string;
  };
  readonly profile: unknown;
  readonly approval: DetachedDocumentInput;
  readonly binding: EdgeIdentityBinding;
  readonly evidence: readonly ClaimedRecordDocument[];
  readonly exemptions?: readonly ClaimedRecordDocument[];
  /** Legacy diagnostic flag. A true value is an explicit refused production request. */
  readonly requireProductionApproved?: boolean;
}
export type PipelineState =
  | 'NOT_STARTED'
  | 'VERIFYING'
  | 'VERIFIED_TEST_ONLY'
  | 'REJECTED'
  | 'INCOMPLETE'
  | 'VERIFIER_UNAVAILABLE';
export interface VerificationAuditStep {
  readonly stepId: string;
  readonly verificationType: string;
  readonly subjectIdentity: string;
  readonly status:
    VerificationStatus | 'PASSED_TEST_ONLY' | 'BLOCKED' | 'INCOMPLETE';
  readonly scope: 'TEST_ONLY';
  readonly policyVersion: string;
  readonly timestamp: string | null;
  readonly diagnosticCodes: readonly string[];
  readonly inputReference: string;
  readonly dependencyReferences: readonly string[];
  readonly resultReference: string;
  readonly lifecycleStatus?: RevocationFacet['status'];
  readonly exemptionDecision?: ExemptionDecisionState;
  readonly pipelineState?: PipelineState;
}
export interface CriterionCompleteness {
  readonly criterion: QualificationCriterion;
  readonly recordCount: number;
  readonly authenticatedRecordCount: number;
  readonly declaredFullEdgeCoverage: boolean;
  readonly actualSurveyCoverage: 'UNVERIFIED';
  readonly physicalTruth: 'UNVERIFIED';
}
export interface VerificationPipelineOutcome {
  readonly state: PipelineState;
  readonly scope: 'TEST_ONLY';
  readonly productionAuthoritative: false;
  readonly qualificationEligible: false;
  readonly auditIsCredential: false;
  readonly diagnosticCodes: readonly string[];
  readonly audit: readonly VerificationAuditStep[];
  readonly completeness: readonly CriterionCompleteness[];
  readonly diagnosticQualification: EdgeQualificationRecord;
  readonly exemptionDecisions: readonly ExemptionDecision[];
}
