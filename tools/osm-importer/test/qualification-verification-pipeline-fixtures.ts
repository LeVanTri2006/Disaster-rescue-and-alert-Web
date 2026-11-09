/** In-memory isolated TEST_ONLY PKI; these IDs do not certify real authorities. */
import { sign } from 'node:crypto';
import {
  DetachedDocumentInput,
  SignedEnvelope,
} from '../src/qualification-crypto-verifier';
import { EdgeIdentityBinding } from '../src/qualification-identity-binding';
import {
  CriterionEvidenceRecord,
  NotApplicableEvidenceRecord,
} from '../src/qualification-types';
import {
  TestVerificationContext,
  VerificationPipelineRequest,
  VerificationPipelineOutcome,
} from '../src/qualification-verification-pipeline-types';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import { isObject } from '../src/qualification-validation';
import { rawSha256 } from '../src/qualification-verification-json';
import { createCompleteInput } from './qualification-fixtures';
import {
  bytesOf,
  testAuthority,
  testEnvelope,
  TEST_AUTHORITY,
  TEST_KEY_ID,
  TEST_NOW,
  TEST_ROOT,
  TEST_SIGNER,
  verificationFixture,
} from './qualification-verification-test-fixtures';

export const EXTRA_AUTHORITIES = [
  'TT_QUAN_LY_HA_TANG_DANANG',
  'BAN_QLDA_DUY_TU_DUONG_BO_DANANG',
];
export const keyId = (id: string) =>
  id === TEST_AUTHORITY ? TEST_KEY_ID : `TEST_ONLY_KEY_${id}`;
export function pipelineAuthorities() {
  return [TEST_AUTHORITY, ...EXTRA_AUTHORITIES].map((authorityId) =>
    testAuthority({ authorityId, keyId: keyId(authorityId) }),
  );
}
export function signEnvelope(envelope: SignedEnvelope): DetachedDocumentInput {
  const bytes = bytesOf(envelope);
  return {
    bytes,
    signatureBase64: sign(null, bytes, TEST_SIGNER.privateKey).toString(
      'base64',
    ),
    algorithm: 'Ed25519',
    keyId: keyId(envelope.authorityId),
    authorityId: envelope.authorityId,
    subjectId: envelope.subjectId,
    category: envelope.category,
    criterion: envelope.criterion,
  };
}
export function signedRecord(
  record: CriterionEvidenceRecord | NotApplicableEvidenceRecord,
  binding: EdgeIdentityBinding,
  category: 'EVIDENCE' | 'EXEMPTION' = 'EVIDENCE',
  bodyExtras: Readonly<Record<string, unknown>> = {},
) {
  const projection = Object.fromEntries(
    Object.entries(record).filter(
      ([k, v]) =>
        v !== undefined &&
        k !== 'documentSha256' &&
        k !== 'digitalSignatureStatus',
    ),
  );
  const document = signEnvelope(
    testEnvelope({
      subjectId: record.evidenceId,
      authorityId: record.sourceAuthorityId,
      category,
      criterion: record.criterion,
      validFrom: 'validFrom' in record ? record.validFrom : record.verifiedAt,
      validUntil: record.validUntil,
      body: { ...bodyExtras, record: projection, binding },
    }),
  );
  return {
    record: {
      ...projection,
      documentSha256: rawSha256(document.bytes!),
      digitalSignatureStatus: record.digitalSignatureStatus,
    },
    document,
  };
}
export function pipelineFixture(
  options: Parameters<typeof verificationFixture>[0] = {},
) {
  const f = verificationFixture({
    ...options,
    registryPatch: {
      authorities: pipelineAuthorities(),
      ...options.registryPatch,
    },
  });
  const request: VerificationPipelineRequest = {
    mode: 'TEST_ONLY',
    evaluatedAt: TEST_NOW,
    registry: {
      bytes: f.registry.config.bytes,
      signatureBase64: f.registry.config.signatureBase64,
    },
    manifest: f.manifestDoc.input,
    graph: { bytes: f.bytes, representation: f.representation },
    profile: f.profile,
    approval: f.approvalDoc.input,
    binding: f.binding,
    evidence: createCompleteInput().evidenceRecords.map((r) =>
      signedRecord(
        {
          ...r,
          graphVersion: f.binding.graphVersion,
          graphArtifactSha256: f.binding.graphArtifactSha256,
        },
        f.binding,
      ),
    ),
  };
  const context: TestVerificationContext = {
    scope: 'TEST_ONLY',
    rootPublicKey: TEST_ROOT.publicKey,
    rootReference: 'TEST_ONLY_OUT_OF_BAND_ROOT',
    clock: isolatedTestClock(TEST_NOW),
  };
  return { ...f, request, context };
}
export function assertLocked(outcome: VerificationPipelineOutcome) {
  expect(outcome).toMatchObject({
    scope: 'TEST_ONLY',
    productionAuthoritative: false,
    qualificationEligible: false,
    auditIsCredential: false,
  });
  expect(outcome.diagnosticQualification).toMatchObject({
    purpose: 'DIAGNOSTIC_ONLY',
    trustStatus: 'UNAVAILABLE',
    qualificationStatus: 'UNVERIFIED',
    isProductionApproved: false,
  });
}
export function firstRecord(
  f: ReturnType<typeof pipelineFixture>,
): CriterionEvidenceRecord {
  // Obtain the typed schema value through the existing validator, never a cast.
  const value = requireRecord(f.request.evidence[0].record);
  return value;
}
import { validateCriterionEvidence } from '../src/qualification-validation';
export function requireRecord(record: unknown): CriterionEvidenceRecord {
  const value = validateCriterionEvidence(record).value;
  if (!value) throw new Error('TEST_RECORD_SCHEMA_INVALID');
  return value;
}
export function replaceSignedEvidence(
  f: ReturnType<typeof pipelineFixture>,
  index: number,
  patch: Partial<CriterionEvidenceRecord>,
) {
  const evidence = [...f.request.evidence];
  evidence[index] = signedRecord(
    { ...requireRecord(evidence[index].record), ...patch },
    f.binding,
  );
  return { ...f.request, evidence };
}
export function resignRegistry(
  f: ReturnType<typeof pipelineFixture>,
  patch: Record<string, unknown>,
) {
  const bytes = bytesOf({ ...f.registry.data, ...patch });
  return {
    ...f.request,
    registry: {
      bytes,
      signatureBase64: sign(null, bytes, TEST_ROOT.privateKey).toString(
        'base64',
      ),
    },
  };
}
export function recordObject(record: unknown) {
  if (!isObject(record)) throw new Error('FIXTURE_NOT_OBJECT');
  return record;
}
