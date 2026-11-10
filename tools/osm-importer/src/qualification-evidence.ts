/** Unauthenticated technical diagnostics. No supersession/exemption can remove
 * evidence without a verifier, and no numeric outcome establishes provenance.
 */
import { RoadEdge } from './types';
import {
  CriterionEvaluationResult, CriterionEvaluationState, CriterionEvidenceRecord,
  EvidenceMeasurementDecision, NotApplicableEvidenceRecord, QualificationCriterion,
  RescueVehicleProfile,
} from './qualification-types';
import {
  isFiniteNumber, isObject, isValidIsoTimestamp, sortedUnique, validateCriterionEvidence,
  validateNotApplicableEvidence, validateVehicleProfile, ValidationOptions,
} from './qualification-validation';

export interface ResolveCriterionParams {
  readonly criterion: QualificationCriterion;
  readonly evidenceList: readonly unknown[];
  readonly notApplicableRecords?: readonly unknown[];
  readonly vehicleProfile: RescueVehicleProfile;
  readonly evaluatedAt: string;
  readonly edge: Pick<RoadEdge, 'id' | 'lengthMeters'> & { readonly metadata?: unknown };
  readonly options?: ValidationOptions;
}
function numericDecision(record: CriterionEvidenceRecord, profile: RescueVehicleProfile): EvidenceMeasurementDecision {
  if (record.criterion === 'LEGAL_ACCESS') return record.booleanValue ? 'PASS_CERTAIN' : 'FAIL_CERTAIN';
  if (record.criterion === 'SURFACE_SUITABILITY') {
    return !record.booleanValue || profile.disallowedSurfaceTypes.includes(record.stringValue!.toLowerCase()) ? 'FAIL_CERTAIN' : 'PASS_CERTAIN';
  }
  const lower = record.measuredValue - record.measurementUncertainty;
  const upper = record.measuredValue + record.measurementUncertainty;
  const thresholds: Partial<Record<QualificationCriterion, number>> = {
    PHYSICAL_HEIGHT_CLEARANCE: profile.overallHeightMeters + profile.verticalMarginMeters,
    PHYSICAL_WIDTH_CLEARANCE: profile.overallWidthMeters + profile.horizontalMarginMeters,
    STRUCTURAL_LOAD_CAPACITY: profile.grossWeightTons * profile.loadSafetyFactor,
    AXLE_LOAD_CAPACITY: profile.maxAxleWeightTons * profile.loadSafetyFactor,
    GEOMETRIC_FEASIBILITY: profile.maxClimbGradientPercent,
    STATIC_TERRAIN_CAPABILITY: profile.groundClearanceMeters,
  };
  const threshold = thresholds[record.criterion];
  if (!isFiniteNumber(threshold) || threshold <= 0 || !Number.isFinite(lower) || !Number.isFinite(upper)) return 'INDETERMINATE';
  const maximum = record.criterion === 'GEOMETRIC_FEASIBILITY' || record.criterion === 'STATIC_TERRAIN_CAPABILITY';
  if (maximum) return upper <= threshold ? 'PASS_CERTAIN' : lower > threshold ? 'FAIL_CERTAIN' : 'INDETERMINATE';
  return lower >= threshold ? 'PASS_CERTAIN' : upper < threshold ? 'FAIL_CERTAIN' : 'INDETERMINATE';
}

/** Tier 1 mathematics only; PASS_CERTAIN is not production authorization. */
export function evaluateEvidenceMeasurement(record: CriterionEvidenceRecord, profile: RescueVehicleProfile): EvidenceMeasurementDecision {
  if (!validateCriterionEvidence(record).valid || !validateVehicleProfile(profile).valid || record.revocationStatus !== 'ACTIVE') return 'INDETERMINATE';
  return numericDecision(record, profile);
}

export function resolveCriterionEvidence(params: ResolveCriterionParams): CriterionEvaluationResult {
  const { criterion, evidenceList, notApplicableRecords = [], vehicleProfile, evaluatedAt, edge, options = {} } = params;
  const reasons: string[] = ['PROVENANCE_UNVERIFIED: no PKI verifier or authoritative survey coverage'];
  const ids: string[] = [];
  const active: CriterionEvidenceRecord[] = [];
  let invalid = false, expired = false;
  const output = (state: CriterionEvaluationState, extra: Partial<CriterionEvaluationResult> = {}): CriterionEvaluationResult => ({
    criterion, state, ...extra, evidenceIdsUsed: sortedUnique(ids), diagnosticReasons: sortedUnique(reasons),
  });
  if (!isValidIsoTimestamp(evaluatedAt)) { reasons.push('INVALID_EVALUATION_TIME'); return output('INVALID'); }
  if (!edge || !isFiniteNumber(edge.lengthMeters) || edge.lengthMeters <= 0) { reasons.push('INVALID_EDGE_LENGTH'); return output('INVALID'); }
  const profileResult = validateVehicleProfile(vehicleProfile, { ...options, evaluatedAt });
  if (!profileResult.valid) { reasons.push(...profileResult.errors); return output('INVALID'); }
  const at = Date.parse(evaluatedAt);
  const validationOptions = { ...options, evaluatedAt, edgeLengthMeters: edge.lengthMeters };

  // Validate every exemption, but never apply it without independently verified
  // identity, graph membership, structure metadata, issuer and signature.
  for (const ex of notApplicableRecords) {
    const val = validateNotApplicableEvidence(ex, edge.metadata, validationOptions);
    reasons.push(...val.errors);
    if (val.value) ids.push(val.value.evidenceId);
    if (!val.valid) invalid = true;
    reasons.push('EXEMPTION_TRUST_UNAVAILABLE: exemption was not applied');
  }
  const counts = new Map<string, number>();
  for (const rec of evidenceList) {
    if (isObject(rec) && typeof rec.evidenceId === 'string') counts.set(rec.evidenceId, (counts.get(rec.evidenceId) ?? 0) + 1);
  }
  for (const rec of evidenceList) {
    const val = validateCriterionEvidence(rec, validationOptions);
    if (!val.value) { invalid = true; reasons.push(...val.errors); reasons.push(`INVALID_RECORD: ${isObject(rec) && typeof rec.evidenceId === 'string' ? rec.evidenceId : 'UNKNOWN'}`); continue; }
    const e = val.value;
    ids.push(e.evidenceId);
    if ((counts.get(e.evidenceId) ?? 0) > 1) { invalid = true; reasons.push(`DUPLICATE_EVIDENCE_ID: ${e.evidenceId}`); continue; }
    if (e.criterion !== criterion || e.edgeId !== edge.id) { invalid = true; reasons.push(`EVIDENCE_IDENTITY_MISMATCH: ${e.evidenceId}`); continue; }
    if (e.supersedesEvidenceId) {
      const previous = evidenceList.map(p => validateCriterionEvidence(p, validationOptions).value).find(p => p?.evidenceId === e.supersedesEvidenceId);
      reasons.push(`SUPERSESSION_NOT_APPLIED: ${e.evidenceId}->${e.supersedesEvidenceId}; trusted verifier unavailable`);
      if (e.evidenceId === e.supersedesEvidenceId) reasons.push(`SELF_SUPERSESSION: ${e.evidenceId}`);
      const seen = new Set<string>([e.evidenceId]);
      let next: CriterionEvidenceRecord | undefined = previous;
      while (next) {
        if (seen.has(next.evidenceId)) { reasons.push(`SUPERSESSION_CYCLE: ${e.evidenceId}`); break; }
        seen.add(next.evidenceId);
        const nextId = next.supersedesEvidenceId;
        next = nextId ? evidenceList.map(p => validateCriterionEvidence(p, validationOptions).value).find(p => p?.evidenceId === nextId) : undefined;
      }
      if (!previous) reasons.push(`SUPERSESSION_TARGET_NOT_FOUND: ${e.evidenceId}`);
      else {
        if (previous.criterion !== e.criterion || previous.edgeId !== e.edgeId) reasons.push(`SUPERSESSION_IDENTITY_MISMATCH: ${e.evidenceId}`);
        if (!isValidIsoTimestamp(previous.evaluatedAt) || Date.parse(e.evaluatedAt) <= Date.parse(previous.evaluatedAt)) reasons.push(`SUPERSESSION_NOT_NEWER: ${e.evidenceId}`);
      }
    }
    if (e.revocationStatus !== 'ACTIVE') { reasons.push(`EVIDENCE_REVOKED: ${e.evidenceId}`); continue; }
    if (at < Date.parse(e.validFrom)) { reasons.push(`EVIDENCE_NOT_YET_EFFECTIVE: ${e.evidenceId}`); expired = true; continue; }
    if (at > Date.parse(e.validUntil)) { reasons.push(`EVIDENCE_EXPIRED: ${e.evidenceId}`); expired = true; continue; }
    active.push(e);
  }
  if (!active.length) return output(invalid ? 'INVALID' : expired ? 'EXPIRED' : 'MISSING');

  // Exact chainage grouping; never merge distinct points by decimal rounding.
  const groups = new Map<string, CriterionEvidenceRecord[]>();
  for (const e of active) {
    const s = e.spatialScope;
    const key = s.scopeType === 'POINT_CHOKEPOINT' ? `POINT:${s.offsetMeters}` :
      s.scopeType === 'SECTION_SPAN' ? `SPAN:${s.fromOffsetMeters}:${s.toOffsetMeters}` : 'FULL_EDGE';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const groupDecisions: { decision: EvidenceMeasurementDecision | 'CONFLICTING'; bound: number }[] = [];
  const maximum = criterion === 'GEOMETRIC_FEASIBILITY' || criterion === 'STATIC_TERRAIN_CAPABILITY';
  const qualitative = criterion === 'LEGAL_ACCESS' || criterion === 'SURFACE_SUITABILITY';
  for (const [key, records] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const decisions = records.map(r => numericDecision(r, vehicleProfile));
    const conflict = qualitative ? new Set(decisions).size > 1 ||
      (criterion === 'SURFACE_SUITABILITY' && new Set(records.map(r => r.stringValue?.toLowerCase())).size > 1) :
      Math.max(...records.map(r => r.measuredValue - r.measurementUncertainty)) > Math.min(...records.map(r => r.measuredValue + r.measurementUncertainty));
    const decision = conflict ? 'CONFLICTING' : decisions.includes('FAIL_CERTAIN') ? 'FAIL_CERTAIN' : decisions.includes('INDETERMINATE') ? 'INDETERMINATE' : 'PASS_CERTAIN';
    // Retain conservative envelope of compatible measurements, not their mean.
    const bound = maximum ? Math.max(...records.map(r => r.measuredValue + r.measurementUncertainty)) : Math.min(...records.map(r => r.measuredValue - r.measurementUncertainty));
    groupDecisions.push({ decision, bound });
    reasons.push(`${decision}: ${key}`);
  }
  const effectiveValidUntil = active.map(r => r.validUntil).sort((a,b) => Date.parse(a) - Date.parse(b) || a.localeCompare(b))[0];
  const extra = {
    effectiveValidUntil,
    effectiveValue: maximum ? Math.max(...groupDecisions.map(g => g.bound)) : Math.min(...groupDecisions.map(g => g.bound)),
    representativeUncertainty: Math.max(...active.map(r => r.measurementUncertainty)),
  };
  if (groupDecisions.some(g => g.decision === 'FAIL_CERTAIN')) {
    // This is a suspected bottleneck, not a confirmed closure without authenticity.
    reasons.push('UNAUTHENTICATED_FAILURE_RETAINED');
    return output('INDETERMINATE', { ...extra, untrustedAssessmentState: 'FAILED', measurementDecision: 'FAIL_CERTAIN' });
  }
  if (groupDecisions.some(g => g.decision === 'CONFLICTING')) return output('CONFLICTING', extra);
  if (groupDecisions.some(g => g.decision === 'INDETERMINATE')) return output('INDETERMINATE', { ...extra, measurementDecision: 'INDETERMINATE' });
  // All eight criteria need full declared coverage. Declarations alone still
  // cannot establish trusted coverage and will never produce SATISFIED below.
  if (!active.some(e => e.spatialScope.scopeType === 'CONTINUOUS_FULL_EDGE')) {
    reasons.push('INSUFFICIENT_SPATIAL_COVERAGE');
    return output('MISSING', { ...extra, measurementDecision: 'PASS_CERTAIN' });
  }
  reasons.push('COVERAGE_UNVERIFIED: full-edge declaration has no authoritative verification');
  return output('INDETERMINATE', { ...extra, untrustedAssessmentState: 'SATISFIED', measurementDecision: 'PASS_CERTAIN' });
}
