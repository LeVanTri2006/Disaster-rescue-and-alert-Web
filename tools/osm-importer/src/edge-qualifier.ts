/** Static diagnostics only. There is deliberately NO production-unlock API in
 * 5C.1R. A caller cannot inject a verifier, boolean, enum or constructed context
 * to mint trust. Missing PKI/loader/clock/survey evidence always fails closed.
 */
import { RoadEdge } from './types';
import {
  ALL_QUALIFICATION_CRITERIA, CriterionEvaluationResult, CriterionEvidenceRecord,
  EdgeQualificationRecord, GEOMETRY_HASH_VERSION, NotApplicableEvidenceRecord,
  QUALIFICATION_POLICY_VERSION, QualificationCriterion, RescueVehicleProfile,
} from './qualification-types';
import { computeCanonicalEdgeGeometryHash } from './qualification-geometry';
import { resolveCriterionEvidence } from './qualification-evidence';
import { isFiniteNumber, isNonEmptyString, isObject, isSha256, isValidIsoTimestamp, sortedUnique, validateCriterionEvidence, validateNotApplicableEvidence, validateVehicleProfile } from './qualification-validation';

export interface EdgeQualificationInput {
  readonly edge: RoadEdge;
  readonly graphVersion: string;
  readonly graphArtifactSha256: string;
  readonly vehicleProfile: RescueVehicleProfile;
  readonly evidenceRecords: readonly CriterionEvidenceRecord[];
  readonly notApplicableRecords?: readonly NotApplicableEvidenceRecord[];
  readonly evaluatedAt: string;
  readonly qualificationPolicyVersion?: string;
  /** Legacy input retained for callers. Neither true, false nor omission grants trust. */
  readonly requireProductionApproved?: boolean;
}

export class EdgeQualifier {
  public qualifyEdge(input: EdgeQualificationInput): EdgeQualificationRecord {
    const errors: string[] = [
      'PRODUCTION_TRUST_UNAVAILABLE: PKI verifier not configured',
      'TRUSTED_GRAPH_CONTEXT_UNAVAILABLE: artifact membership and endpoints not verified',
      'TRUSTED_CLOCK_UNAVAILABLE: caller time cannot authorize production',
      'AUTHORITATIVE_SURVEY_COVERAGE_UNAVAILABLE',
    ];
    const warnings: string[] = [];
    let canonicalGeometryHash = 'UNKNOWN_HASH';
    const safeInput: Record<string, unknown> = isObject(input) ? input : {};
    const edge: Record<string, unknown> = isObject(safeInput.edge) ? safeInput.edge : {};
    const profile: Record<string, unknown> = isObject(safeInput.vehicleProfile) ? safeInput.vehicleProfile : {};
    const text = (v: unknown) => typeof v === 'string' ? v : '';
    const evaluatedAt = text(safeInput.evaluatedAt);
    if (!isNonEmptyString(safeInput.graphVersion)) errors.push('INVALID_GRAPH_VERSION');
    if (!isSha256(safeInput.graphArtifactSha256)) errors.push('INVALID_GRAPH_ARTIFACT_HASH');
    if (safeInput.qualificationPolicyVersion !== undefined && safeInput.qualificationPolicyVersion !== QUALIFICATION_POLICY_VERSION) errors.push('QUALIFICATION_POLICY_VERSION_MISMATCH');
    if (!isValidIsoTimestamp(evaluatedAt)) errors.push('INVALID_EVALUATION_TIME');
    if (!isNonEmptyString(edge.id)) errors.push('INVALID_EDGE_IDENTITY');
    if (!isFiniteNumber(edge.lengthMeters) || edge.lengthMeters <= 0) errors.push('INVALID_EDGE_LENGTH');
    try { canonicalGeometryHash = computeCanonicalEdgeGeometryHash(safeInput.edge); }
    catch (err: unknown) { errors.push(`CANONICAL_GEOMETRY_ERROR: ${err instanceof Error ? err.message : String(err)}`); }
    const profileValidation = validateVehicleProfile(profile, { evaluatedAt });
    errors.push(...profileValidation.errors);
    const evidence: readonly unknown[] = Array.isArray(safeInput.evidenceRecords) ? safeInput.evidenceRecords : [];
    const exemptions: readonly unknown[] = Array.isArray(safeInput.notApplicableRecords) ? safeInput.notApplicableRecords : [];
    if (!Array.isArray(safeInput.evidenceRecords)) errors.push('INVALID_EVIDENCE_COLLECTION');
    if (safeInput.notApplicableRecords !== undefined && !Array.isArray(safeInput.notApplicableRecords)) errors.push('INVALID_EXEMPTION_COLLECTION');
    const counts = new Map<string, number>();
    for (const rec of [...evidence, ...exemptions]) {
      if (!isObject(rec)) { errors.push('INVALID_EVIDENCE_RECORD'); continue; }
      if (typeof rec.evidenceId === 'string') counts.set(rec.evidenceId, (counts.get(rec.evidenceId) ?? 0) + 1);
      if (rec.edgeId !== edge.id) warnings.push(`EVIDENCE_EDGE_MISMATCH: ${text(rec.evidenceId)}`);
      if (rec.canonicalGeometryHash !== canonicalGeometryHash) warnings.push(`EVIDENCE_GEOMETRY_MISMATCH: ${text(rec.evidenceId)}`);
      if (!ALL_QUALIFICATION_CRITERIA.some(c => c === rec.criterion)) errors.push(`INVALID_CRITERION: ${text(rec.evidenceId)}`);
    }
    for (const [id, count] of counts) if (count > 1) errors.push(`DUPLICATE_EVIDENCE_ID: ${id}`);
    const binding = {
      edgeId: text(edge.id), canonicalGeometryHash, geometryHashVersion: GEOMETRY_HASH_VERSION,
      graphVersion: text(safeInput.graphVersion), graphArtifactSha256: text(safeInput.graphArtifactSha256),
      qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
    };
    const criteriaResults = Object.fromEntries(ALL_QUALIFICATION_CRITERIA.map(criterion => {
      const localErrors = errors.filter(e => !e.includes('UNAVAILABLE'));
      // Even if graph/profile/time validation fails, retain independent schema
      // failures from every supplied record rather than hiding the other defects.
      const schemaReasons = [...evidence, ...exemptions].filter(r => isObject(r) && r.criterion === criterion).flatMap(r => {
        const options = { binding, evaluatedAt, edgeLengthMeters: isFiniteNumber(edge.lengthMeters) ? edge.lengthMeters : NaN };
        return exemptions.includes(r) ? [...validateNotApplicableEvidence(r, edge.metadata, options).errors] : [...validateCriterionEvidence(r, options).errors];
      });
      const result: CriterionEvaluationResult = localErrors.length ? {
        criterion, state: 'INVALID', evidenceIdsUsed: [], diagnosticReasons: sortedUnique([...localErrors, ...schemaReasons]),
      } : resolveCriterionEvidence({
        criterion,
        evidenceList: evidence.filter((r: unknown) => isObject(r) && r.criterion === criterion),
        notApplicableRecords: exemptions.filter((r: unknown) => isObject(r) && r.criterion === criterion),
        vehicleProfile: profileValidation.value!, evaluatedAt,
        edge: { id: text(edge.id), lengthMeters: isFiniteNumber(edge.lengthMeters) ? edge.lengthMeters : NaN, metadata: edge.metadata }, options: { binding },
      });
      return [criterion, result];
    })) as Record<QualificationCriterion, CriterionEvaluationResult>;
    const expirations = Object.values(criteriaResults).flatMap(r => r.effectiveValidUntil ? [r.effectiveValidUntil] : []).sort((a,b) => Date.parse(a) - Date.parse(b) || a.localeCompare(b));
    return {
      purpose: 'DIAGNOSTIC_ONLY', trustStatus: 'UNAVAILABLE',
      geometryHashVersion: GEOMETRY_HASH_VERSION, qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
      edgeId: text(edge.id), canonicalGeometryHash,
      graphVersion: text(safeInput.graphVersion), graphArtifactSha256: text(safeInput.graphArtifactSha256),
      targetVehicleProfileId: text(profile.profileId), targetVehicleProfileVersion: text(profile.profileVersion),
      qualificationStatus: 'UNVERIFIED', isProductionApproved: false,
      criteriaResults, overallEvaluationTimestamp: evaluatedAt,
      ...(expirations.length ? { earliestExpirationTimestamp: expirations[0] } : {}),
      qualificationErrors: sortedUnique(errors), qualificationWarnings: sortedUnique(warnings),
    };
  }
}
