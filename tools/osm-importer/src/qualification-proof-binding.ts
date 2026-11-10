import { verifyEdgeIdentity } from './qualification-identity-binding';
import { inspectVerifiedGraph } from './qualification-artifact-verifier';
import { inspectClock, verifyValidity } from './qualification-trusted-clock';
import { validateAuthoritativeProof } from './qualification-proof-validation';
import { evaluateDeclaredSurveyCoverage } from './qualification-proof-coverage';
import { revalidateMultiKeyDocument } from './qualification-multikey-registry';
import {
  AuthoritativeProof,
  StructureInventoryProof,
  SurveyProof,
  SurveyExtent,
  SurveyMeasurement,
} from './qualification-proof-types';
import {
  canonicalJson,
  immutableJson,
  rawSha256,
} from './qualification-verification-json';
import { QualificationCriterion } from './qualification-types';
import { isObject } from './qualification-validation';

export interface ProofPacket {
  readonly proof: unknown;
  readonly documentBytes: Uint8Array;
  readonly documentReceipt: unknown;
}
export interface ProofBindingContext {
  readonly registryReceipt: unknown;
  readonly graphReceipt: unknown;
  readonly profileReceipt: unknown;
  readonly binding: unknown;
  readonly criterion: QualificationCriterion;
  readonly inventoryPacket?: ProofPacket;
  readonly priorSurveyPackets?: readonly ProofPacket[];
}
export type BoundProofState =
  'BOUND_TEST_ONLY' | 'INVALID' | 'UNAVAILABLE' | 'INCOMPLETE' | 'CONFLICTING';
export interface BoundProofAssessment {
  readonly state: BoundProofState;
  readonly scope: 'TEST_ONLY';
  readonly productionAuthoritative: false;
  readonly qualificationEligible: false;
  readonly documentIntegrity: 'MATCH' | 'UNAVAILABLE' | 'MISMATCH';
  readonly documentAuthenticity: 'VERIFIED_TEST_ONLY' | 'UNVERIFIED';
  readonly legalAuthority: 'PERMISSION_VERIFIED_TEST_ONLY' | 'UNVERIFIED';
  readonly legalApplicability: 'UNAVAILABLE';
  readonly measurementRecorded: boolean;
  readonly measurementAuthenticated: boolean;
  readonly measurementSpatialBinding:
    'CHAINAGE_AND_ENVELOPE_ONLY' | 'UNVERIFIED';
  readonly geometricCoverage:
    'GEOMETRIC_COVERAGE_VALID' | 'INCOMPLETE' | 'INVALID' | 'NOT_EVALUATED';
  readonly authoritativeCoverage: 'UNVERIFIED';
  readonly physicalTruth: 'UNVERIFIED';
  readonly calibration: 'REFERENCE_ONLY_NOT_VERIFIED';
  readonly retainedBottleneckIds: readonly string[];
  readonly diagnosticCodes: readonly string[];
}
export function proofSignedProjection(proof: AuthoritativeProof): unknown {
  const { sha256: _digest, ...document } = proof.document;
  return { ...proof, document };
}
function assessmentsConflict(a: SurveyProof, b: SurveyProof): boolean {
  return a.measurements.some((x) =>
    b.measurements.some(
      (y) =>
        x.structureId === y.structureId &&
        x.criterion === y.criterion &&
        canonicalJson(x.extent) === canonicalJson(y.extent) &&
        (x.value + x.uncertainty < y.value - y.uncertainty ||
          y.value + y.uncertainty < x.value - x.uncertainty),
    ),
  );
}
function coversExtent(
  target: SurveyExtent,
  measurements: readonly SurveyMeasurement[],
): boolean {
  if (target.kind === 'POINT')
    return measurements.some((m) =>
      m.extent.kind === 'POINT'
        ? m.extent.offset === target.offset
        : m.extent.from <= target.offset && m.extent.to >= target.offset,
    );
  const spans = measurements
    .flatMap((m) =>
      m.extent.kind === 'SPAN'
        ? [{ from: m.extent.from, to: m.extent.to }]
        : [],
    )
    .sort((a, b) => a.from - b.from || a.to - b.to);
  let end = target.from;
  for (const span of spans) {
    if (span.to <= end) continue;
    if (span.from > end) return false;
    end = Math.max(end, span.to);
    if (end >= target.to) return true;
  }
  return false;
}
export function verifyAuthoritativeProofClaim(
  packet: unknown,
  context: ProofBindingContext,
  reading: unknown,
): BoundProofAssessment {
  let state: BoundProofState = 'INVALID',
    integrity: BoundProofAssessment['documentIntegrity'] = 'UNAVAILABLE',
    authenticity: BoundProofAssessment['documentAuthenticity'] = 'UNVERIFIED',
    authority: BoundProofAssessment['legalAuthority'] = 'UNVERIFIED',
    spatial: BoundProofAssessment['measurementSpatialBinding'] = 'UNVERIFIED',
    geometric: BoundProofAssessment['geometricCoverage'] = 'NOT_EVALUATED';
  const codes = [
      'NO_PRODUCTION_QUALIFICATION',
      'PHYSICAL_TRUTH_NOT_ESTABLISHED',
      'AUTHORITATIVE_COVERAGE_UNVERIFIED',
      'CALIBRATION_REFERENCE_NOT_VERIFIED',
    ],
    bottlenecks: string[] = [];
  let recorded = false,
    authenticated = false;
  const denials = new Set<BoundProofState>();
  function deny(next: BoundProofState) {
    denials.add(next);
    state = next;
  }
  const finish = (): BoundProofAssessment =>
    immutableJson({
      state: denials.has('INVALID')
        ? 'INVALID'
        : denials.has('CONFLICTING')
          ? 'CONFLICTING'
          : denials.has('UNAVAILABLE')
            ? 'UNAVAILABLE'
            : denials.has('INCOMPLETE')
              ? 'INCOMPLETE'
              : state,
      scope: 'TEST_ONLY',
      productionAuthoritative: false,
      qualificationEligible: false,
      documentIntegrity: integrity,
      documentAuthenticity: authenticity,
      legalAuthority: authority,
      legalApplicability: 'UNAVAILABLE',
      measurementRecorded: recorded,
      measurementAuthenticated: authenticated,
      measurementSpatialBinding: spatial,
      geometricCoverage: geometric,
      authoritativeCoverage: 'UNVERIFIED',
      physicalTruth: 'UNVERIFIED',
      calibration: 'REFERENCE_ONLY_NOT_VERIFIED',
      retainedBottleneckIds: [...new Set(bottlenecks)].sort(),
      diagnosticCodes: [...new Set(codes)].sort(),
    });
  try {
    if (!isObject(packet)) {
      codes.push('PROOF_PACKET_REQUIRED');
      return finish();
    }
    const validation = validateAuthoritativeProof(packet.proof);
    codes.push(...validation.diagnosticCodes);
    if (!validation.value) return finish();
    const proof = validation.value;
    if (proof.criterion !== context.criterion) {
      codes.push('PROOF_CRITERION_CONTEXT_MISMATCH');
      return finish();
    }
    const priorSchemas = (context.priorSurveyPackets ?? [])
      .map((p) => validateAuthoritativeProof(p.proof).value)
      .filter((p): p is SurveyProof => p?.kind === 'SURVEY');
    for (const p of [proof, ...priorSchemas])
      if (p.kind === 'SURVEY')
        for (const m of p.measurements)
          if (m.finding === 'SUSPECTED_BOTTLENECK')
            bottlenecks.push(m.measurementId);
    recorded = proof.kind === 'SURVEY' && proof.measurements.length > 0;
    if (!(packet.documentBytes instanceof Uint8Array)) {
      state = 'UNAVAILABLE';
      codes.push('PROOF_DOCUMENT_BYTES_MISSING');
      return finish();
    }
    integrity =
      rawSha256(packet.documentBytes) === proof.document.sha256
        ? 'MATCH'
        : 'MISMATCH';
    if (integrity === 'MISMATCH') {
      codes.push('PROOF_DOCUMENT_DIGEST_MISMATCH');
      return finish();
    }
    const document = revalidateMultiKeyDocument(
      packet.documentReceipt,
      context.registryReceipt,
      reading,
    );
    if (document.status !== 'VERIFIED_TEST_ONLY' || !document.details) {
      state = 'UNAVAILABLE';
      codes.push(
        'PROOF_DOCUMENT_AUTHENTICITY_UNAVAILABLE',
        ...document.diagnosticCodes,
      );
      return finish();
    }
    const d = document.details,
      e = d.envelope;
    if (
      d.documentSha256 !== proof.document.sha256 ||
      e.subjectId !== proof.document.documentId ||
      e.authorityId !== proof.document.authorityId ||
      e.keyId !== proof.document.keyId ||
      e.category !== proof.document.category ||
      e.criterion !== proof.criterion ||
      d.registry.registryId !== proof.document.registryId ||
      d.registry.snapshotId !== proof.document.snapshotId ||
      e.validFrom !== proof.validFrom ||
      e.validUntil !== proof.validUntil ||
      canonicalJson(e.body.proof) !==
        canonicalJson(proofSignedProjection(proof))
    ) {
      codes.push('PROOF_SOURCE_DOCUMENT_IDENTITY_MISMATCH');
      return finish();
    }
    authenticity = 'VERIFIED_TEST_ONLY';
    authority = 'PERMISSION_VERIFIED_TEST_ONLY';
    authenticated = recorded;
    const validity = verifyValidity(
      {
        validFrom: proof.validFrom,
        validUntil: proof.validUntil,
        revocationStatus: proof.revocation.status,
      },
      reading,
    );
    if (validity.status !== 'VERIFIED') {
      codes.push(
        ...validity.diagnosticCodes,
        'PROOF_EXPIRED_REVOKED_OR_TIME_UNAVAILABLE',
      );
      return finish();
    }
    const binding = verifyEdgeIdentity(
      {
        binding: context.binding,
        graphVerification: context.graphReceipt,
        profileVerification: context.profileReceipt,
      },
      reading,
    );
    if (binding.status !== 'VERIFIED') {
      state = 'UNAVAILABLE';
      codes.push(...binding.diagnosticCodes);
      return finish();
    }
    if (canonicalJson(proof.binding) !== canonicalJson(binding.details)) {
      codes.push('PROOF_GRAPH_EDGE_DIRECTION_PROFILE_POLICY_MISMATCH');
      return finish();
    }
    const graph = inspectVerifiedGraph(context.graphReceipt, reading),
      edge = graph?.graph.edges.find((x) => x.id === proof.binding.edgeId);
    if (!edge || edge.lengthMeters !== proof.edgeLengthMeters) {
      codes.push('PROOF_EDGE_LENGTH_OR_MEMBERSHIP_MISMATCH');
      return finish();
    }
    state = 'BOUND_TEST_ONLY';
    if (proof.conflictStatus === 'UNRESOLVED') {
      deny('CONFLICTING');
      codes.push('PROOF_DECLARED_CONFLICT_UNRESOLVED');
    }
    let inventory: StructureInventoryProof | undefined;
    if (proof.kind === 'STRUCTURE_INVENTORY') {
      inventory = proof;
      if (
        proof.osmBridgeTag === 'NO' &&
        proof.structures.some(
          (s) =>
            s.type === 'CULVERT' ||
            s.type === 'BRIDGE' ||
            s.type === 'CROSSING',
        )
      )
        codes.push('CROSSING_INVENTORY_OVERRIDES_OSM_ABSENCE_CLAIM');
      if (proof.hiddenStructures === 'UNKNOWN')
        codes.push('HIDDEN_STRUCTURE_INVENTORY_UNVERIFIED');
      for (const s of proof.structures)
        if (
          !proof.references.some(
            (r) =>
              r.documentId === s.inspectionDocumentId &&
              r.role === 'INSPECTION',
          )
        ) {
          deny('INCOMPLETE');
          codes.push('STRUCTURE_INSPECTION_REFERENCE_UNRESOLVED');
        }
      codes.push('INVENTORY_AUTHENTICATED_NOT_PHYSICALLY_ESTABLISHED');
    } else {
      if (!context.inventoryPacket) {
        deny('INCOMPLETE');
        codes.push('VERIFIED_STRUCTURE_INVENTORY_REQUIRED');
      } else {
        const iv = validateAuthoritativeProof(context.inventoryPacket.proof);
        const ia = verifyAuthoritativeProofClaim(
          context.inventoryPacket,
          { ...context, inventoryPacket: undefined, priorSurveyPackets: [] },
          reading,
        );
        if (
          iv.value?.kind !== 'STRUCTURE_INVENTORY' ||
          ia.state !== 'BOUND_TEST_ONLY'
        ) {
          deny(ia.state === 'CONFLICTING' ? 'CONFLICTING' : 'INCOMPLETE');
          codes.push('STRUCTURE_INVENTORY_NOT_BOUND', ...ia.diagnosticCodes);
        } else inventory = iv.value;
      }
    }
    if (proof.kind === 'LEGAL') {
      if (
        inventory &&
        !inventory.structures.some((s) => s.structureId === proof.structureId)
      ) {
        deny('INVALID');
        codes.push('LEGAL_PROOF_WRONG_STRUCTURE');
      }
      codes.push(
        'LEGAL_BASIS_PROVIDER_UNAVAILABLE',
        'LEGAL_APPLICABILITY_NOT_ESTABLISHED',
      );
    }
    if (proof.kind === 'SURVEY') {
      const coverage = evaluateDeclaredSurveyCoverage(
        edge.lengthMeters,
        proof.measurements,
      );
      geometric = coverage.state;
      codes.push(...coverage.diagnosticCodes);
      if (
        coverage.state !== 'GEOMETRIC_COVERAGE_VALID' &&
        !denials.has('CONFLICTING')
      )
        deny('INCOMPLETE');
      if (
        proof.coverageDeclaration === 'WHOLE_EDGE' &&
        coverage.state !== 'GEOMETRIC_COVERAGE_VALID'
      )
        codes.push('FULL_EDGE_CLAIM_WITHOUT_SUPPORTING_OBSERVATIONS');
      const clock = inspectClock(reading);
      const at = clock?.timestamp ? Date.parse(clock.timestamp) : NaN;
      if (!Number.isFinite(at) || at > Date.parse(proof.reinspection.dueAt)) {
        deny('INVALID');
        codes.push('SURVEY_REINSPECTION_OVERDUE');
      }
      for (const m of proof.measurements) {
        if (
          Date.parse(m.collectedAt) > at ||
          at - Date.parse(m.collectedAt) >
            proof.reinspection.maximumAgeSeconds * 1000
        ) {
          deny('INVALID');
          codes.push('SURVEY_COLLECTION_FUTURE_OR_TOO_OLD');
        }
        if (
          m.surveyAuthorityId !== proof.document.authorityId ||
          m.sourceDocumentId !== proof.document.documentId
        ) {
          deny('INVALID');
          codes.push('SURVEY_SOURCE_IDENTITY_MISMATCH');
        }
        if (
          !proof.references.some(
            (r) =>
              r.documentId === m.calibrationReference &&
              r.role === 'CALIBRATION',
          )
        ) {
          deny('INCOMPLETE');
          codes.push('SURVEY_CALIBRATION_REFERENCE_UNRESOLVED');
        }
        if (
          m.location.lat < Math.min(...edge.geometry.map((p) => p.lat)) ||
          m.location.lat > Math.max(...edge.geometry.map((p) => p.lat)) ||
          m.location.lon < Math.min(...edge.geometry.map((p) => p.lon)) ||
          m.location.lon > Math.max(...edge.geometry.map((p) => p.lon))
        ) {
          deny('INVALID');
          codes.push('SURVEY_LOCATION_OUTSIDE_EDGE_ENVELOPE');
        }
        if (
          inventory &&
          !inventory.structures.some(
            (s) =>
              s.structureId === m.structureId &&
              s.surveyDocumentId === proof.document.documentId,
          )
        ) {
          deny('INVALID');
          codes.push('SURVEY_WRONG_STRUCTURE_OR_DOCUMENT');
        }
        if (m.supersedesMeasurementId) {
          if (state === 'BOUND_TEST_ONLY') deny('INCOMPLETE');
          codes.push('SURVEY_SUPERSESSION_NOT_AUTHORIZED');
        }
      }
      if (inventory)
        for (const structure of inventory.structures) {
          const observations = proof.measurements.filter(
            (m) =>
              m.structureId === structure.structureId &&
              m.disposition === 'ACTIVE',
          );
          const covered = coversExtent(structure.extent, observations);
          if (
            !covered &&
            !denials.has('INVALID') &&
            !denials.has('CONFLICTING')
          ) {
            deny('INCOMPLETE');
            codes.push('STRUCTURE_SPECIFIC_SURVEY_COVERAGE_MISSING');
          }
        }
      spatial = 'CHAINAGE_AND_ENVELOPE_ONLY';
      if (proof.supersedesProofId) {
        if (state === 'BOUND_TEST_ONLY') deny('INCOMPLETE');
        codes.push('PROOF_SUPERSESSION_NOT_AUTHORIZED');
      }
      if (
        priorSchemas.some((p) => assessmentsConflict(p, proof)) ||
        assessmentsConflict(proof, proof)
      ) {
        deny('CONFLICTING');
        codes.push('SURVEY_OBSERVATIONS_CONFLICTING');
      }
    }
    return finish();
  } catch {
    deny('INVALID');
    codes.push('PROOF_BINDING_EXCEPTION');
    return finish();
  }
}
