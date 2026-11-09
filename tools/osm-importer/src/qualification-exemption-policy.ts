/** Legal applicability is distinct from a signed claim. There is deliberately
 * no success branch until legal/structure/survey proof verifiers exist. */
import { authorizeTestAuthority } from './qualification-authority-registry';
import { inspectVerifiedDocument } from './qualification-crypto-verifier';
import {
  parseExemptionDocumentRecord,
  verifyEvidenceDocument,
} from './qualification-document-verifier';
import { inspectVerifiedGraph } from './qualification-artifact-verifier';
import {
  inspectVerifiedProfile,
  profileConfigurationIdentity,
} from './qualification-profile-verifier';
import { verifyEdgeIdentity } from './qualification-identity-binding';
import { inspectClock } from './qualification-trusted-clock';
import {
  canonicalJson,
  immutableJson,
  rawSha256,
} from './qualification-verification-json';
import { documentClaim } from './qualification-verification-adapters';
import { evaluateEvidenceMeasurement } from './qualification-evidence';
import {
  CRITERIA_NEVER_EXEMPTIBLE,
  CriterionEvidenceRecord,
  QualificationCriterion,
} from './qualification-types';
import {
  isObject,
  isNonEmptyString,
  validateCriterionEvidence,
  validateVehicleProfile,
} from './qualification-validation';
import { VerificationStatus } from './qualification-trust-types';

export const EXEMPTION_POLICY_VERSION =
  'qualification-test-exemption-v1' as const;
export type ExemptionDecisionState =
  | 'APPLICABLE_TEST_ONLY'
  | 'NOT_APPLICABLE'
  | 'INDETERMINATE'
  | 'INVALID'
  | 'CONFLICTING'
  | 'UNAVAILABLE';
export interface ExemptionDecision {
  readonly state: ExemptionDecisionState;
  readonly scope: 'TEST_ONLY';
  readonly policyVersion: typeof EXEMPTION_POLICY_VERSION;
  readonly timestamp: string | null;
  readonly productionAuthoritative: false;
  readonly qualificationEligible: false;
  readonly isCredential: false;
  readonly criterion: QualificationCriterion | null;
  readonly exemptionCategory: string | null;
  readonly legalBasisReference: string | null;
  readonly physicalStructureIdentity: string | null;
  readonly graphEdgeProfilePolicyBinding: unknown;
  readonly sourceDocumentIdentity: string | null;
  readonly authorityVerificationReference: string | null;
  readonly validFrom: string | null;
  readonly validUntil: string | null;
  readonly authenticity: VerificationStatus;
  readonly authority: VerificationStatus;
  readonly identity: VerificationStatus;
  readonly applicability: 'NOT_ESTABLISHED';
  readonly evidenceConflict:
    | 'NONE_OBSERVED'
    | 'UNRESOLVED_FAILURE'
    | 'UNRESOLVED_CONFLICT'
    | 'INDETERMINATE';
  readonly confirmedPhysicalFailure: 'NOT_ESTABLISHED';
  readonly evidenceReferences: readonly string[];
  readonly diagnosticCodes: readonly string[];
}
/** All caller objects are claims. Document/graph/profile receipts are checked
 * in the originating WeakMaps; no booleans or engine assessments are trusted. */
export function evaluateTestExemption(
  input: unknown,
  reading: unknown,
): ExemptionDecision {
  const at = inspectClock(reading)?.timestamp ?? null;
  const codes: string[] = ['EXEMPTION_NOT_APPLIED_TO_ENGINE'];
  const refs: string[] = [];
  let state: ExemptionDecisionState = 'UNAVAILABLE',
    authenticity: VerificationStatus = 'UNVERIFIED',
    authority: VerificationStatus = 'VERIFIER_UNAVAILABLE',
    identity: VerificationStatus = 'UNVERIFIED';
  let criterion: QualificationCriterion | null = null,
    category: string | null = null,
    legal: string | null = null,
    structure: string | null = null,
    source: string | null = null,
    authRef: string | null = null,
    from: string | null = null,
    until: string | null = null,
    binding: unknown = null;
  let conflict: ExemptionDecision['evidenceConflict'] = 'INDETERMINATE';
  function finish(): ExemptionDecision {
    return immutableJson({
      state,
      scope: 'TEST_ONLY',
      policyVersion: EXEMPTION_POLICY_VERSION,
      timestamp: at,
      productionAuthoritative: false,
      qualificationEligible: false,
      isCredential: false,
      criterion,
      exemptionCategory: category,
      legalBasisReference: legal,
      physicalStructureIdentity: structure,
      graphEdgeProfilePolicyBinding: binding,
      sourceDocumentIdentity: source,
      authorityVerificationReference: authRef,
      validFrom: from,
      validUntil: until,
      authenticity,
      authority,
      identity,
      applicability: 'NOT_ESTABLISHED',
      evidenceConflict: conflict,
      confirmedPhysicalFailure: 'NOT_ESTABLISHED',
      evidenceReferences: [...new Set(refs)].sort(),
      diagnosticCodes: [...new Set(codes)].sort(),
    });
  }
  try {
    if (!isObject(input)) {
      codes.push('EXEMPTION_INPUT_MISSING');
      return finish();
    }
    const record = parseExemptionDocumentRecord(input.record);
    if (!record) {
      state = 'INVALID';
      codes.push('EXEMPTION_RECORD_SCHEMA_INVALID');
      return finish();
    }
    criterion = record.criterion;
    category = record.justificationCode;
    from = record.verifiedAt;
    until = record.validUntil;
    const doc = inspectVerifiedDocument(
      input.documentVerification,
      'EXEMPTION',
      reading,
      input.registry,
    );
    const selector = documentClaim(input.document, 'EXEMPTION');
    const auth = authorizeTestAuthority(
      input.registry,
      reading,
      doc?.envelope.authorityId ?? selector?.authorityId ?? '',
      doc?.keyId ?? selector?.keyId ?? '',
      'EXEMPTION',
      criterion,
      record.evidenceId,
    );
    authority = auth.status;
    authRef = auth.trustSourceReference;
    if (auth.status !== 'VERIFIED') codes.push(...auth.diagnosticCodes);
    const verification = verifyEvidenceDocument(
      {
        category: 'EXEMPTION',
        record: input.record,
        documentBytes:
          input.documentBytes instanceof Uint8Array
            ? input.documentBytes
            : undefined,
        documentVerification: input.documentVerification,
        expectedRegistry: input.registry,
      },
      reading,
    );
    authenticity = verification.authenticity.status;
    if (authenticity !== 'VERIFIED')
      codes.push(
        ...verification.authenticity.diagnosticCodes,
        `EXEMPTION_${authenticity}`,
      );
    source = doc?.documentSha256 ?? null;
    const edgeIdentity = verifyEdgeIdentity(
      {
        binding: input.binding,
        graphVerification: input.graphVerification,
        profileVerification: input.profileVerification,
      },
      reading,
    );
    identity = edgeIdentity.status;
    const graph = inspectVerifiedGraph(input.graphVerification, reading),
      profile = inspectVerifiedProfile(input.profileVerification, reading);
    const currentApproval = inspectVerifiedDocument(
      input.profileApprovalVerification,
      'PROFILE_APPROVAL',
      reading,
      input.registry,
    );
    let bindingMatches = false;
    if (edgeIdentity.status === 'VERIFIED' && doc) {
      binding = edgeIdentity.details;
      const keys = [
        'graphVersion',
        'graphArtifactSha256',
        'edgeId',
        'canonicalGeometryHash',
        'geometryHashVersion',
        'qualificationPolicyVersion',
      ] as const;
      bindingMatches =
        keys.every((k) => record[k] === edgeIdentity.details[k]) &&
        isObject(doc.envelope.body.binding) &&
        canonicalJson(doc.envelope.body.binding) ===
          canonicalJson(edgeIdentity.details) &&
        !!graph &&
        !!inspectVerifiedDocument(
          graph.documentVerification,
          'GRAPH_MANIFEST',
          reading,
          input.registry,
        ) &&
        profile?.profileId === edgeIdentity.details.targetVehicleProfileId &&
        !!currentApproval &&
        currentApproval.documentSha256 === profile.approvalDocumentSha256;
    }
    if (!bindingMatches) {
      identity = 'INVALID';
      codes.push(
        'EXEMPTION_GRAPH_EDGE_PROFILE_POLICY_MISMATCH',
        ...edgeIdentity.diagnosticCodes,
      );
    }
    const context =
      doc && isObject(doc.envelope.body.exemptionContext)
        ? doc.envelope.body.exemptionContext
        : undefined;
    legal = isNonEmptyString(context?.legalBasisReference)
      ? context.legalBasisReference
      : null;
    structure = isNonEmptyString(context?.physicalStructureIdentity)
      ? context.physicalStructureIdentity
      : null;
    if (!legal) codes.push('LEGAL_BASIS_REFERENCE_MISSING');
    if (!structure) codes.push('PHYSICAL_STRUCTURE_IDENTITY_MISSING');
    // Signed declarations cannot replace separately verified legal, physical
    // structure and survey records, which this repository does not model yet.
    codes.push(
      'VERIFIED_LEGAL_BASIS_PROOF_UNAVAILABLE',
      'VERIFIED_PHYSICAL_STRUCTURE_PROOF_UNAVAILABLE',
      'TRUSTED_SURVEY_COVERAGE_UNAVAILABLE',
    );
    if (context?.proof !== undefined)
      codes.push('CLAIMED_PROOF_IS_NOT_VERIFIED_PROOF');
    const metadata = isObject(input.edgeMetadata)
      ? input.edgeMetadata
      : undefined;
    const load =
      criterion === 'STRUCTURAL_LOAD_CAPACITY' ||
      criterion === 'AXLE_LOAD_CAPACITY';
    let veto = CRITERIA_NEVER_EXEMPTIBLE.includes(criterion);
    if (veto) codes.push('CRITERION_CANNOT_BE_EXEMPTED');
    if (
      !metadata ||
      typeof metadata.bridge !== 'boolean' ||
      typeof metadata.tunnel !== 'boolean'
    )
      codes.push('STRUCTURE_METADATA_MISSING');
    if (load && metadata?.bridge === true) {
      veto = true;
      codes.push('BRIDGE_LOAD_EXEMPTION_FORBIDDEN');
    }
    if (load && metadata?.tunnel === true) {
      veto = true;
      codes.push('TUNNEL_LOAD_EXEMPTION_FORBIDDEN');
    }
    if (load && metadata?.bridge === false)
      codes.push('OSM_BRIDGE_FALSE_IS_NOT_NO_STRUCTURE_PROOF');
    if (
      context?.culvertPresent === true ||
      context?.hiddenStructurePresent === true
    ) {
      veto = true;
      codes.push('CROSSING_OR_HIDDEN_STRUCTURE_UNRESOLVED');
    }
    if (criterion === 'STATIC_TERRAIN_CAPABILITY') {
      if (
        metadata?.highwayType === 'track' ||
        metadata?.highwayType === 'path' ||
        metadata?.highwayType === 'footway'
      ) {
        veto = true;
        codes.push('TRACK_PATH_TERRAIN_EXEMPTION_FORBIDDEN');
      }
      if (
        isObject(metadata?.rawTags) &&
        metadata.rawTags.incline !== undefined
      ) {
        veto = true;
        codes.push('COMPLEX_TERRAIN_EXEMPTION_FORBIDDEN');
      }
      codes.push('HIGHWAY_CLASSIFICATION_IS_NOT_VERIFIED_DESIGN_PROOF');
    }
    const expectedJustification = load
      ? 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE'
      : 'GRADE_SEPARATED_STANDARD_HIGHWAY';
    if (category !== expectedJustification) {
      veto = true;
      codes.push('EXEMPTION_CATEGORY_INAPPLICABLE');
    }
    const measurements: CriterionEvidenceRecord[] = [];
    let hasFailure = false,
      hasConflict = false,
      indeterminate = false;
    if (!Array.isArray(input.evidenceDocuments)) {
      indeterminate = true;
      codes.push('EVIDENCE_RECONCILIATION_INPUT_MISSING');
    } else
      for (const item of input.evidenceDocuments) {
        if (!isObject(item)) {
          indeterminate = true;
          codes.push('EVIDENCE_INPUT_INVALID');
          continue;
        }
        if (
          isObject(item.record) &&
          item.record.criterion === criterion &&
          isNonEmptyString(item.record.evidenceId)
        )
          refs.push(`sha256:${rawSha256(Buffer.from(item.record.evidenceId))}`);
        const schema = validateCriterionEvidence(item.record, {
          evaluatedAt: at ?? undefined,
          binding:
            edgeIdentity.status === 'VERIFIED'
              ? edgeIdentity.details
              : undefined,
          edgeLengthMeters: graph?.graph.edges.find(
            (e) => e.id === record.edgeId,
          )?.lengthMeters,
        });
        if (!schema.value) {
          indeterminate = true;
          codes.push('EVIDENCE_INVALID', ...schema.errors);
          continue;
        }
        if (schema.value.criterion !== criterion) continue;
        const r = schema.value;
        const evidenceAuth = verifyEvidenceDocument(
          {
            category: 'EVIDENCE',
            record: item.record,
            documentBytes:
              item.documentBytes instanceof Uint8Array
                ? item.documentBytes
                : undefined,
            documentVerification: item.documentVerification,
            expectedRegistry: input.registry,
          },
          reading,
        ).authenticity;
        const evidenceDoc = inspectVerifiedDocument(
          item.documentVerification,
          'EVIDENCE',
          reading,
          input.registry,
        );
        if (evidenceAuth.status !== 'VERIFIED' || !evidenceDoc) {
          indeterminate = true;
          codes.push(
            `EVIDENCE_${evidenceAuth.status}`,
            ...evidenceAuth.diagnosticCodes,
          );
          continue;
        }
        if (
          edgeIdentity.status !== 'VERIFIED' ||
          !isObject(evidenceDoc.envelope.body.binding) ||
          canonicalJson(evidenceDoc.envelope.body.binding) !==
            canonicalJson(edgeIdentity.details)
        ) {
          indeterminate = true;
          codes.push('EVIDENCE_PROFILE_POLICY_BINDING_MISMATCH');
          continue;
        }
        const vehicle = validateVehicleProfile(input.profile).value;
        if (
          !vehicle ||
          !profile ||
          vehicle.profileId !== profile.profileId ||
          vehicle.profileVersion !== profile.profileVersion ||
          profileConfigurationIdentity(vehicle).sha256 !==
            profile.configurationSha256
        ) {
          indeterminate = true;
          codes.push('EVIDENCE_VEHICLE_CONTEXT_UNAVAILABLE');
          continue;
        }
        // Measurement diagnostics are conservative vetoes, never legal/physical facts.
        const decision = evaluateEvidenceMeasurement(r, vehicle);
        if (decision === 'FAIL_CERTAIN') {
          hasFailure = true;
          codes.push('UNRESOLVED_TEST_MEASUREMENT_FAILURE');
        }
        if (decision === 'INDETERMINATE') {
          indeterminate = true;
          codes.push('EVIDENCE_MEASUREMENT_INDETERMINATE');
        }
        if (r.spatialScope.scopeType !== 'CONTINUOUS_FULL_EDGE') {
          indeterminate = true;
          codes.push('EVIDENCE_SPATIAL_COVERAGE_INCOMPLETE');
        }
        for (const previous of measurements)
          if (
            canonicalJson(previous.spatialScope) ===
            canonicalJson(r.spatialScope)
          ) {
            if (
              previous.evidenceId === r.evidenceId ||
              previous.booleanValue !== r.booleanValue ||
              previous.stringValue !== r.stringValue ||
              (criterion !== 'LEGAL_ACCESS' &&
                criterion !== 'SURFACE_SUITABILITY' &&
                (previous.measuredValue + previous.measurementUncertainty <
                  r.measuredValue - r.measurementUncertainty ||
                  r.measuredValue + r.measurementUncertainty <
                    previous.measuredValue - previous.measurementUncertainty))
            ) {
              hasConflict = true;
              codes.push('EVIDENCE_CONFLICT_UNRESOLVED');
            }
          }
        measurements.push(r);
      }
    conflict = hasConflict
      ? 'UNRESOLVED_CONFLICT'
      : hasFailure
        ? 'UNRESOLVED_FAILURE'
        : indeterminate
          ? 'INDETERMINATE'
          : 'NONE_OBSERVED';
    if (
      authenticity === 'EXPIRED' ||
      authenticity === 'REVOKED' ||
      authenticity === 'INVALID' ||
      authority === 'REVOKED' ||
      authority === 'UNTRUSTED_ISSUER' ||
      identity === 'INVALID'
    )
      state = 'INVALID';
    else if (authenticity !== 'VERIFIED' || authority !== 'VERIFIED')
      state = 'UNAVAILABLE';
    else if (hasFailure || hasConflict) state = 'CONFLICTING';
    else if (veto) state = 'NOT_APPLICABLE';
    else state = 'INDETERMINATE';
    return finish();
  } catch {
    state = 'INVALID';
    codes.push('EXEMPTION_POLICY_EXCEPTION');
    return finish();
  }
}
