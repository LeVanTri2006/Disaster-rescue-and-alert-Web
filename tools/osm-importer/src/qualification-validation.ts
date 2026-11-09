/** Structural validation never establishes authenticity. No caller-supplied
 * signature enum, authority name, hash or test option can establish trust.
 */
import {
  ALL_QUALIFICATION_CRITERIA, AUTHORIZED_AUTHORITIES_BY_CRITERION,
  CRITERIA_NEVER_EXEMPTIBLE, CriterionEvidenceRecord, NotApplicableEvidenceRecord,
  QualificationCriterion, RescueVehicleProfile, GEOMETRY_HASH_VERSION,
  QUALIFICATION_POLICY_VERSION, EvidenceGraphBinding,
} from './qualification-types';

export interface ValidationResult<T = never> {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  /** Present only after the complete structural schema has passed. NOT trusted. */
  readonly value?: T;
}
export interface ValidationOptions {
  /** Only permits schema inspection of synthetic names, never production trust. */
  readonly allowSynthetic?: boolean;
  readonly evaluatedAt?: string;
  readonly edgeLengthMeters?: number;
  readonly binding?: EvidenceGraphBinding & { readonly edgeId: string; readonly canonicalGeometryHash: string };
}
export const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v === v.trim();
export const isSha256 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const signatures = ['VERIFIED_TRUSTED', 'UNVERIFIED_NOT_CONFIGURED', 'INVALID_SIGNATURE', 'UNTRUSTED_ISSUER', 'EXPIRED_CERTIFICATE', 'REVOKED_CERTIFICATE'];
const methods = ['OFFICIAL_GOVERNMENT_GAZETTE', 'DIGITAL_SIGNATURE_X509', 'CERTIFIED_HARDCOPY_ARCHIVE', 'UNVERIFIED_DEVELOPMENT_PROTOTYPE'];
export function isSyntheticAuthority(v: unknown): boolean {
  return typeof v === 'string' && /^(TEST|MOCK|SYNTH|DEV)_/i.test(v);
}
export function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return false;
  // Reject normalization of impossible dates (e.g. February 30), leap seconds,
  // 24:00 and non-UTC/ambiguous representations. Validity is closed [from, until].
  return new Date(epoch).toISOString() === (value.length === 20 ? value.replace('Z', '.000Z') : value);
}
export function isAuthorityWhitelistedForCriterion(authority: string, criterion: QualificationCriterion): boolean {
  return Object.prototype.hasOwnProperty.call(AUTHORIZED_AUTHORITIES_BY_CRITERION, criterion) &&
    AUTHORIZED_AUTHORITIES_BY_CRITERION[criterion].includes(authority);
}
function requiredStrings(obj: Record<string, unknown>, keys: readonly string[], errors: string[]): void {
  for (const key of keys) if (!isNonEmptyString(obj[key])) errors.push(`INVALID_REQUIRED_FIELD: ${key}`);
}
function timestamps(obj: Record<string, unknown>, keys: readonly string[], errors: string[]): void {
  for (const key of keys) if (!isValidIsoTimestamp(obj[key])) errors.push(`INVALID_TIMESTAMP: ${key}`);
}
function enumField(obj: Record<string, unknown>, key: string, values: readonly string[], errors: string[]): void {
  if (typeof obj[key] !== 'string' || !values.includes(obj[key])) errors.push(`INVALID_ENUM: ${key}`);
}
function interval(from: unknown, until: unknown, at: unknown, errors: string[]): void {
  if (!isValidIsoTimestamp(from) || !isValidIsoTimestamp(until)) return;
  if (Date.parse(from) > Date.parse(until)) errors.push('INVALID_VALIDITY_INTERVAL');
  if (at !== undefined) {
    if (!isValidIsoTimestamp(at)) errors.push('INVALID_EVALUATION_TIME');
    else if (Date.parse(at) < Date.parse(from) || Date.parse(at) > Date.parse(until)) errors.push('OUTSIDE_VALIDITY_INTERVAL');
  }
}
function arrayField(value: unknown, key: string, nonEmpty: boolean, errors: string[]): void {
  if (!Array.isArray(value) || (nonEmpty && !value.length) || !value.every(isNonEmptyString)) {
    errors.push(`INVALID_STRING_ARRAY: ${key}`); return;
  }
  if (JSON.stringify(value) !== JSON.stringify(sortedUnique(value))) errors.push(`NON_CANONICAL_STRING_ARRAY: ${key}`);
}
function result<T>(errors: string[], value?: T): ValidationResult<T> {
  return { valid: errors.length === 0, errors: sortedUnique(errors), warnings: [], ...(errors.length === 0 ? { value } : {}) };
}
export function validateVehicleProfile(profile: unknown, options: ValidationOptions = {}): ValidationResult<RescueVehicleProfile> {
  const errors: string[] = [];
  if (!isObject(profile)) return result(['PROFILE_NOT_OBJECT']);
  requiredStrings(profile, ['profileId', 'profileName', 'profileVersion'], errors);
  if (typeof profile.profileVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(profile.profileVersion)) errors.push('INVALID_PROFILE_VERSION');
  enumField(profile, 'status', ['ACTIVE_APPROVED', 'PROVISIONAL_DEVELOPMENT', 'REVOKED'], errors);
  if (profile.status !== 'ACTIVE_APPROVED') errors.push('UNAPPROVED_PROFILE_STATUS');
  for (const key of ['overallHeightMeters', 'overallWidthMeters', 'overallLengthMeters', 'grossWeightTons', 'maxAxleWeightTons', 'groundClearanceMeters', 'turningRadiusMeters', 'maxClimbGradientPercent', 'approachAngleDegrees', 'departureAngleDegrees']) {
    const v = profile[key];
    if (!isFiniteNumber(v) || v <= 0) errors.push(`INVALID_DIMENSION: ${key}`);
  }
  for (const key of ['fordingDepthMeters', 'verticalMarginMeters', 'horizontalMarginMeters']) {
    const v = profile[key];
    if (!isFiniteNumber(v) || v < 0) errors.push(`INVALID_MARGIN: ${key}`);
  }
  if (!isFiniteNumber(profile.loadSafetyFactor) || profile.loadSafetyFactor < 1) errors.push('INVALID_LOAD_SAFETY_FACTOR');
  for (const key of ['approachAngleDegrees', 'departureAngleDegrees']) if (isFiniteNumber(profile[key]) && profile[key] > 90) errors.push(`INVALID_ANGLE: ${key}`);
  for (const key of ['allowsBridges', 'allowsTunnels']) if (typeof profile[key] !== 'boolean') errors.push(`INVALID_BOOLEAN: ${key}`);
  arrayField(profile.allowedHighwayTypes, 'allowedHighwayTypes', true, errors);
  arrayField(profile.disallowedSurfaceTypes, 'disallowedSurfaceTypes', false, errors);
  const prov = profile.approvalProvenance;
  if (!isObject(prov)) errors.push('MISSING_PROVENANCE');
  else {
    requiredStrings(prov, ['issuingAuthority', 'authorityRegistryCode', 'documentTitle', 'documentReferenceNumber', 'profileVersion', 'approvingOfficerName', 'approvingOfficerRole'], errors);
    if (!isSha256(prov.documentSha256)) errors.push('INVALID_PROVENANCE_DOCUMENT_HASH');
    timestamps(prov, ['issuedAt', 'effectiveFrom', 'effectiveUntil'], errors);
    interval(prov.effectiveFrom, prov.effectiveUntil, options.evaluatedAt, errors);
    if (prov.profileVersion !== profile.profileVersion) errors.push('PROFILE_VERSION_MISMATCH');
    if (isValidIsoTimestamp(prov.issuedAt) && isValidIsoTimestamp(prov.effectiveFrom) && Date.parse(prov.issuedAt) > Date.parse(prov.effectiveFrom)) errors.push('INVALID_ISSUANCE_TIME');
    enumField(prov, 'revocationStatus', ['ACTIVE', 'REVOKED_SAFETY_NOTICE'], errors);
    if (prov.revocationStatus !== 'ACTIVE') errors.push('REVOKED_PROFILE');
    enumField(prov, 'verificationMethod', methods, errors);
    enumField(prov, 'digitalSignatureStatus', signatures, errors);
    if (prov.digitalSignatureStatus !== 'VERIFIED_TRUSTED') errors.push('PROFILE_SIGNATURE_NOT_VERIFIED');
    if (prov.supersedesProfileVersion !== undefined && !isNonEmptyString(prov.supersedesProfileVersion)) errors.push('INVALID_SUPERSEDES_PROFILE_VERSION');
    if (!options.allowSynthetic && (isSyntheticAuthority(prov.issuingAuthority) || isSyntheticAuthority(prov.authorityRegistryCode))) errors.push('SYNTHETIC_DATA_LEAK_DETECTED');
    if (prov.verificationMethod === 'UNVERIFIED_DEVELOPMENT_PROTOTYPE') errors.push('PROTOTYPE_PROFILE_IN_PRODUCTION');
  }
  for (const [dimension, margin, multiply] of [
    ['overallHeightMeters', 'verticalMarginMeters', false],
    ['overallWidthMeters', 'horizontalMarginMeters', false],
    ['grossWeightTons', 'loadSafetyFactor', true],
    ['maxAxleWeightTons', 'loadSafetyFactor', true],
  ] as const) {
    const a = profile[dimension], b = profile[margin];
    if (isFiniteNumber(a) && isFiniteNumber(b) && !Number.isFinite(multiply ? a * b : a + b)) errors.push(`INVALID_COMPUTED_THRESHOLD: ${dimension}`);
  }
  // Cast only after all required structural fields, enums and numbers are checked.
  return result(errors, profile as unknown as RescueVehicleProfile);
}

function commonEvidence(e: Record<string, unknown>, options: ValidationOptions, errors: string[]): void {
  requiredStrings(e, ['evidenceId', 'edgeId', 'sourceAuthorityId', 'graphVersion'], errors);
  const criterion = e.criterion;
  if (typeof criterion !== 'string' || !ALL_QUALIFICATION_CRITERIA.some(c => c === criterion)) errors.push('INVALID_CRITERION');
  else if (typeof e.sourceAuthorityId === 'string' && !isAuthorityWhitelistedForCriterion(e.sourceAuthorityId, criterion as QualificationCriterion) && !(options.allowSynthetic && isSyntheticAuthority(e.sourceAuthorityId))) errors.push('UNAUTHORIZED_AUTHORITY');
  if (!options.allowSynthetic && isSyntheticAuthority(e.sourceAuthorityId)) errors.push('SYNTHETIC_DATA_LEAK_DETECTED');
  for (const key of ['canonicalGeometryHash', 'documentSha256', 'graphArtifactSha256']) if (!isSha256(e[key])) errors.push(`INVALID_HASH: ${key}`);
  if (e.geometryHashVersion !== GEOMETRY_HASH_VERSION) errors.push('GEOMETRY_HASH_VERSION_MISMATCH');
  if (e.qualificationPolicyVersion !== QUALIFICATION_POLICY_VERSION) errors.push('QUALIFICATION_POLICY_VERSION_MISMATCH');
  enumField(e, 'revocationStatus', ['ACTIVE', 'REVOKED'], errors);
  enumField(e, 'digitalSignatureStatus', signatures, errors);
  if (e.digitalSignatureStatus !== 'VERIFIED_TRUSTED') errors.push('EVIDENCE_SIGNATURE_NOT_VERIFIED');
  if (options.binding) {
    for (const key of ['edgeId', 'canonicalGeometryHash', 'geometryHashVersion', 'graphVersion', 'graphArtifactSha256', 'qualificationPolicyVersion'] as const) {
      if (e[key] !== options.binding[key]) errors.push(`EVIDENCE_BINDING_MISMATCH: ${key}`);
    }
  }
}
export function validateSpatialScope(scope: unknown, length?: number): readonly string[] {
  const errors: string[] = [];
  if (!isObject(scope)) return ['INVALID_SPATIAL_SCOPE'];
  enumField(scope, 'scopeType', ['CONTINUOUS_FULL_EDGE', 'POINT_CHOKEPOINT', 'SECTION_SPAN'], errors);
  if (scope.locationDescription !== undefined && !isNonEmptyString(scope.locationDescription)) errors.push('INVALID_LOCATION_DESCRIPTION');
  if (length !== undefined && (!isFiniteNumber(length) || length <= 0)) errors.push('INVALID_EDGE_LENGTH');
  for (const key of ['offsetMeters', 'fromOffsetMeters', 'toOffsetMeters']) {
    const v = scope[key];
    if (v !== undefined && (!isFiniteNumber(v) || v < 0 || (length !== undefined && v > length))) errors.push(`INVALID_SPATIAL_OFFSET: ${key}`);
  }
  if (scope.scopeType === 'POINT_CHOKEPOINT' && !isFiniteNumber(scope.offsetMeters)) errors.push('MISSING_POINT_OFFSET');
  if (scope.scopeType === 'SECTION_SPAN' && (!isFiniteNumber(scope.fromOffsetMeters) || !isFiniteNumber(scope.toOffsetMeters) || scope.fromOffsetMeters >= scope.toOffsetMeters)) errors.push('INVALID_SECTION_SPAN');
  if (scope.scopeType === 'CONTINUOUS_FULL_EDGE' && ['offsetMeters', 'fromOffsetMeters', 'toOffsetMeters'].some(k => scope[k] !== undefined)) errors.push('AMBIGUOUS_FULL_EDGE_SCOPE');
  if (scope.scopeType === 'POINT_CHOKEPOINT' && (scope.fromOffsetMeters !== undefined || scope.toOffsetMeters !== undefined)) errors.push('AMBIGUOUS_POINT_SCOPE');
  if (scope.scopeType === 'SECTION_SPAN' && scope.offsetMeters !== undefined) errors.push('AMBIGUOUS_SPAN_SCOPE');
  return errors;
}
export const CRITERION_UNITS: Readonly<Record<QualificationCriterion, string>> = Object.freeze({
  LEGAL_ACCESS: 'boolean', PHYSICAL_HEIGHT_CLEARANCE: 'm', PHYSICAL_WIDTH_CLEARANCE: 'm',
  STRUCTURAL_LOAD_CAPACITY: 't', AXLE_LOAD_CAPACITY: 't', SURFACE_SUITABILITY: 'enum',
  GEOMETRIC_FEASIBILITY: '%', STATIC_TERRAIN_CAPABILITY: 'm',
});
export function validateCriterionEvidence(evidence: unknown, options: ValidationOptions = {}): ValidationResult<CriterionEvidenceRecord> {
  const errors: string[] = [];
  if (!isObject(evidence)) return result(['EVIDENCE_NOT_OBJECT']);
  commonEvidence(evidence, options, errors);
  requiredStrings(evidence, ['sourceDocumentRef'], errors);
  const value = evidence.measuredValue, delta = evidence.measurementUncertainty;
  if (!isFiniteNumber(value) || value < 0) errors.push('INVALID_MEASURED_VALUE');
  if (!isFiniteNumber(delta) || delta <= 0) errors.push('INVALID_UNCERTAINTY');
  if (isFiniteNumber(value) && isFiniteNumber(delta) && (!Number.isFinite(value - delta) || !Number.isFinite(value + delta))) errors.push('INVALID_COMPUTED_BOUNDS');
  if (typeof evidence.criterion === 'string' && Object.prototype.hasOwnProperty.call(CRITERION_UNITS, evidence.criterion) && evidence.unit !== CRITERION_UNITS[evidence.criterion as QualificationCriterion]) errors.push('INVALID_UNIT');
  if (evidence.criterion === 'LEGAL_ACCESS' || evidence.criterion === 'SURFACE_SUITABILITY') {
    if (typeof evidence.booleanValue !== 'boolean') errors.push('MISSING_BOOLEAN_VALUE');
  }
  if (evidence.criterion === 'SURFACE_SUITABILITY' && !isNonEmptyString(evidence.stringValue)) errors.push('MISSING_SURFACE_CLASSIFICATION');
  if (evidence.booleanValue !== undefined && typeof evidence.booleanValue !== 'boolean') errors.push('INVALID_BOOLEAN_VALUE');
  if (evidence.stringValue !== undefined && !isNonEmptyString(evidence.stringValue)) errors.push('INVALID_STRING_VALUE');
  errors.push(...validateSpatialScope(evidence.spatialScope, options.edgeLengthMeters));
  timestamps(evidence, ['evaluatedAt', 'validFrom', 'validUntil'], errors);
  interval(evidence.validFrom, evidence.validUntil, undefined, errors);
  if (isValidIsoTimestamp(evidence.evaluatedAt) && isValidIsoTimestamp(evidence.validUntil) && Date.parse(evidence.evaluatedAt) > Date.parse(evidence.validUntil)) errors.push('MEASUREMENT_AFTER_EXPIRATION');
  if (isValidIsoTimestamp(options.evaluatedAt) && isValidIsoTimestamp(evidence.evaluatedAt) && Date.parse(evidence.evaluatedAt) > Date.parse(options.evaluatedAt)) errors.push('FUTURE_MEASUREMENT');
  if (evidence.supersedesEvidenceId !== undefined && !isNonEmptyString(evidence.supersedesEvidenceId)) errors.push('INVALID_SUPERSESSION_REFERENCE');
  return result(errors, evidence as unknown as CriterionEvidenceRecord);
}
export function validateNotApplicableEvidence(evidence: unknown, edgeMetadata?: unknown, options: ValidationOptions = {}): ValidationResult<NotApplicableEvidenceRecord> {
  const errors: string[] = [];
  if (!isObject(evidence)) return result(['EXEMPTION_NOT_OBJECT']);
  commonEvidence(evidence, options, errors);
  requiredStrings(evidence, ['technicalJustificationDetails', 'referenceCadastreMapNumber'], errors);
  if (CRITERIA_NEVER_EXEMPTIBLE.some(c => c === evidence.criterion)) errors.push('CRITERION_CANNOT_BE_EXEMPTED');
  const load = evidence.criterion === 'STRUCTURAL_LOAD_CAPACITY' || evidence.criterion === 'AXLE_LOAD_CAPACITY';
  const justification = load ? 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE' : 'GRADE_SEPARATED_STANDARD_HIGHWAY';
  if (evidence.justificationCode !== justification) errors.push('INVALID_EXEMPTION_JUSTIFICATION');
  const metadata = isObject(edgeMetadata) ? edgeMetadata : undefined;
  if (!metadata || typeof metadata.bridge !== 'boolean' || typeof metadata.tunnel !== 'boolean') errors.push('MISSING_STRUCTURE_METADATA');
  if (load && (metadata?.bridge || metadata?.tunnel)) errors.push('BRIDGE_OR_TUNNEL_CANNOT_BE_EXEMPTED');
  if (evidence.criterion === 'STATIC_TERRAIN_CAPABILITY' && (['track', 'path', 'footway'].includes(typeof metadata?.highwayType === 'string' ? metadata.highwayType : '') || (isObject(metadata?.rawTags) && metadata.rawTags.incline !== undefined))) errors.push('STEEP_TRACK_CANNOT_BE_EXEMPTED_FROM_TERRAIN');
  timestamps(evidence, ['verifiedAt', 'validUntil'], errors);
  interval(evidence.verifiedAt, evidence.validUntil, options.evaluatedAt, errors);
  return result(errors, evidence as unknown as NotApplicableEvidenceRecord);
}
