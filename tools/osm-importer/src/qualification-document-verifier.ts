import {
  ALL_QUALIFICATION_CRITERIA,
  GEOMETRY_HASH_VERSION,
  QUALIFICATION_POLICY_VERSION,
  NotApplicableEvidenceRecord,
} from './qualification-types';
import { inspectVerifiedDocument } from './qualification-crypto-verifier';
import { inspectClock, verifyValidity } from './qualification-trusted-clock';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';
import { canonicalJson, rawSha256 } from './qualification-verification-json';
import {
  isObject,
  validateCriterionEvidence,
  isNonEmptyString,
  isSha256,
  isValidIsoTimestamp,
} from './qualification-validation';

/** Authenticity schema excludes legal/physical applicability. No OSM flag can
 * establish an exemption, and bridge=true cannot invalidate a real signature. */
export function parseExemptionDocumentRecord(
  value: unknown,
): NotApplicableEvidenceRecord | undefined {
  if (!isObject(value)) return undefined;
  const strings = [
    'evidenceId',
    'edgeId',
    'sourceAuthorityId',
    'graphVersion',
    'technicalJustificationDetails',
    'referenceCadastreMapNumber',
  ];
  const criterion = ALL_QUALIFICATION_CRITERIA.find(
    (c) => c === value.criterion,
  );
  const justificationCode = [
    'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE',
    'GRADE_SEPARATED_STANDARD_HIGHWAY',
    'UNRESTRICTED_PUBLIC_EMERGENCY_CORRIDOR',
    'NO_OVERHEAD_STRUCTURE_OR_VEGETATION',
  ].find((c) => c === value.justificationCode);
  if (
    !criterion ||
    !justificationCode ||
    !strings.every((k) => isNonEmptyString(value[k])) ||
    !['canonicalGeometryHash', 'documentSha256', 'graphArtifactSha256'].every(
      (k) => isSha256(value[k]),
    ) ||
    !isValidIsoTimestamp(value.verifiedAt) ||
    !isValidIsoTimestamp(value.validUntil) ||
    Date.parse(value.verifiedAt) > Date.parse(value.validUntil) ||
    value.geometryHashVersion !== GEOMETRY_HASH_VERSION ||
    value.qualificationPolicyVersion !== QUALIFICATION_POLICY_VERSION ||
    (value.revocationStatus !== 'ACTIVE' &&
      value.revocationStatus !== 'REVOKED') ||
    value.digitalSignatureStatus !== 'VERIFIED_TRUSTED'
  )
    return undefined;
  const text = (key: string): string =>
    typeof value[key] === 'string' ? value[key] : '';
  // The branch spells out literal values, with no cast or trusted-result minting.
  const legalCode =
    justificationCode === 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE'
      ? justificationCode
      : justificationCode === 'GRADE_SEPARATED_STANDARD_HIGHWAY'
        ? justificationCode
        : justificationCode === 'UNRESTRICTED_PUBLIC_EMERGENCY_CORRIDOR'
          ? justificationCode
          : 'NO_OVERHEAD_STRUCTURE_OR_VEGETATION';
  return {
    evidenceId: text('evidenceId'),
    edgeId: text('edgeId'),
    sourceAuthorityId: text('sourceAuthorityId'),
    graphVersion: text('graphVersion'),
    technicalJustificationDetails: text('technicalJustificationDetails'),
    referenceCadastreMapNumber: text('referenceCadastreMapNumber'),
    canonicalGeometryHash: text('canonicalGeometryHash'),
    documentSha256: text('documentSha256'),
    graphArtifactSha256: text('graphArtifactSha256'),
    criterion,
    justificationCode: legalCode,
    verifiedAt: value.verifiedAt,
    validUntil: value.validUntil,
    geometryHashVersion: GEOMETRY_HASH_VERSION,
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
    revocationStatus: value.revocationStatus,
    digitalSignatureStatus: 'VERIFIED_TRUSTED',
  };
}
export interface IntegrityDetails {
  readonly computedDigest: string;
  readonly claimedDigest: string;
  readonly trustedExpectedDigest: string | null;
}
export interface RecordAuthenticityDetails {
  readonly subjectId: string;
  readonly documentSha256: string;
  readonly category: 'EVIDENCE' | 'EXEMPTION';
}
export interface DocumentVerification {
  readonly integrity: VerificationResult<IntegrityDetails>;
  readonly authenticity: VerificationResult<RecordAuthenticityDetails>;
}
export function verifyEvidenceDocument(
  input: {
    readonly category: 'EVIDENCE' | 'EXEMPTION';
    readonly record: unknown;
    readonly documentBytes?: Uint8Array;
    readonly documentVerification?: unknown;
    readonly edgeMetadata?: unknown;
    readonly expectedRegistry?: unknown;
  },
  reading: unknown,
): DocumentVerification {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'DOCUMENT_INTEGRITY',
        isObject(input) &&
          isObject(input.record) &&
          typeof input.record.evidenceId === 'string'
          ? input.record.evidenceId
          : 'UNKNOWN_EVIDENCE',
        clock?.timestamp ?? null,
        null,
        'TECHNICAL_ONLY',
      ),
      method: 'SHA256_EXACT_DOCUMENT_BYTES',
    };
  const authMeta = {
    ...meta,
    verificationType: 'DOCUMENT_AUTHENTICITY',
    method: 'SIGNED_RECORD_BINDING',
  };
  const reject = (
    status: Exclude<VerificationResult<never>['status'], 'VERIFIED'>,
    codes: readonly string[],
  ): DocumentVerification =>
    Object.freeze({
      integrity: failure(meta, status, codes),
      authenticity: failure(authMeta, status, codes),
    });
  try {
    if (input.category !== 'EVIDENCE' && input.category !== 'EXEMPTION')
      return reject('INVALID', ['DOCUMENT_CATEGORY_INVALID']);
    const evidenceValidation =
      input.category === 'EVIDENCE'
        ? validateCriterionEvidence(input.record, {
            evaluatedAt: clock?.timestamp ?? undefined,
          })
        : undefined;
    const r =
      input.category === 'EVIDENCE'
        ? evidenceValidation?.value
        : parseExemptionDocumentRecord(input.record);
    if (!r)
      return reject(
        'INVALID',
        evidenceValidation?.errors ?? ['DOCUMENT_RECORD_SCHEMA_INVALID'],
      );
    if (!(input.documentBytes instanceof Uint8Array))
      return reject('UNVERIFIED', ['DOCUMENT_BYTES_MISSING']);
    const digest = rawSha256(Buffer.from(input.documentBytes));
    if (digest !== r.documentSha256)
      return reject('INVALID', ['DOCUMENT_CLAIMED_DIGEST_MISMATCH']);
    const doc = inspectVerifiedDocument(
      input.documentVerification,
      input.category,
      reading,
      input.expectedRegistry,
    );
    if (doc && doc.documentSha256 !== digest)
      return reject('INVALID', ['DOCUMENT_RECEIPT_BYTES_MISMATCH']);
    const details = Object.freeze({
      computedDigest: digest,
      claimedDigest: r.documentSha256,
      trustedExpectedDigest: doc?.documentSha256 ?? null,
    });
    const integrity: VerificationResult<IntegrityDetails> =
      doc && clock?.timestamp
        ? Object.freeze({
            ...meta,
            artifactIdentity: Object.freeze({ sha256: digest }),
            scope: 'TEST_ONLY',
            verificationTimestamp: clock.timestamp,
            trustSourceReference: `SIGNED_TEST_DOCUMENT:${digest}`,
            status: 'VERIFIED',
            assurance: 'TEST_BYTE_INTEGRITY',
            details,
            diagnosticCodes: Object.freeze([
              'DOCUMENT_INTEGRITY_VERIFIED',
              'TEST_EXPECTED_DIGEST_ONLY',
            ]),
          })
        : failure(
            meta,
            'UNVERIFIED',
            [
              'CLAIMED_DIGEST_MATCH_ONLY',
              'TRUSTED_DOCUMENT_REFERENCE_UNAVAILABLE',
            ],
            details,
          );
    const window = verifyValidity(
      {
        validFrom: 'validFrom' in r ? r.validFrom : r.verifiedAt,
        validUntil: r.validUntil,
        collectedAt: 'evaluatedAt' in r ? r.evaluatedAt : r.verifiedAt,
        revocationStatus: r.revocationStatus,
      },
      reading,
    );
    if (window.status !== 'VERIFIED')
      return Object.freeze({
        integrity,
        authenticity: failure(authMeta, window.status, window.diagnosticCodes),
      });
    if (!doc)
      return Object.freeze({
        integrity,
        authenticity: failure(authMeta, 'UNVERIFIED', [
          'DOCUMENT_AUTHENTICITY_UNAVAILABLE',
        ]),
      });
    const envelope = doc.envelope;
    const projection = Object.fromEntries(
      Object.entries(r).filter(
        ([key]) =>
          key !== 'documentSha256' &&
          key !== 'digitalSignatureStatus' &&
          r[key as keyof typeof r] !== undefined,
      ),
    );
    if (
      envelope.subjectId !== r.evidenceId ||
      envelope.authorityId !== r.sourceAuthorityId ||
      envelope.criterion !== r.criterion ||
      envelope.validFrom !== ('validFrom' in r ? r.validFrom : r.verifiedAt) ||
      envelope.validUntil !== r.validUntil ||
      !isObject(envelope.body.record) ||
      canonicalJson(envelope.body.record) !== canonicalJson(projection)
    ) {
      return Object.freeze({
        integrity,
        authenticity: failure(authMeta, 'INVALID', [
          'SIGNED_RECORD_BINDING_MISMATCH',
        ]),
      });
    }
    const authenticity: VerificationResult<RecordAuthenticityDetails> =
      Object.freeze({
        ...authMeta,
        scope: 'TEST_ONLY',
        verificationTimestamp: clock!.timestamp!,
        trustSourceReference: `SIGNED_TEST_DOCUMENT:${digest}`,
        artifactIdentity: Object.freeze({ sha256: digest }),
        status: 'VERIFIED',
        assurance: 'TEST_DOCUMENT_AUTHENTICITY',
        details: Object.freeze({
          subjectId: r.evidenceId,
          documentSha256: digest,
          category: input.category,
        }),
        diagnosticCodes: Object.freeze([
          'DOCUMENT_AUTHENTICITY_VERIFIED_TEST_ONLY',
          'NOT_QUALIFICATION_ELIGIBLE',
        ]),
      });
    return Object.freeze({ integrity, authenticity });
  } catch {
    return reject('INVALID', ['DOCUMENT_INTEGRITY_OR_BINDING_ERROR']);
  }
}
