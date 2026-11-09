import { gunzipSync } from 'node:zlib';
import { DetachedDocumentInput } from './qualification-crypto-verifier';
import { DocumentCategory } from './qualification-trust-types';
import { GraphEdgeIdentity } from './qualification-artifact-verifier';
import {
  canonicalJson,
  parseJsonBytes,
} from './qualification-verification-json';
import {
  ALL_QUALIFICATION_CRITERIA,
  CriterionEvidenceRecord,
  NotApplicableEvidenceRecord,
  RescueVehicleProfile,
} from './qualification-types';
import { isObject, validateVehicleProfile } from './qualification-validation';
import { RoadEdge } from './types';
import { ClaimedRecordDocument } from './qualification-verification-pipeline-types';

export function jsonSnapshot(value: unknown): unknown {
  return parseJsonBytes(Buffer.from(canonicalJson(value)));
}
/** Strict allowlists prevent a discarded payload trust anchor/receipt from
 * appearing to have been accepted. Raw documents are copied before callbacks. */
export function onlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return (
    Object.keys(value).every((k) => allowed.includes(k)) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (d) => !d.get && !d.set,
    )
  );
}
export function documentClaim(
  value: unknown,
  category: DocumentCategory,
): DetachedDocumentInput | undefined {
  if (
    !isObject(value) ||
    !onlyKeys(value, [
      'bytes',
      'signatureBase64',
      'algorithm',
      'keyId',
      'authorityId',
      'subjectId',
      'category',
      'criterion',
    ]) ||
    !(value.bytes instanceof Uint8Array) ||
    typeof value.signatureBase64 !== 'string' ||
    typeof value.algorithm !== 'string' ||
    typeof value.keyId !== 'string' ||
    typeof value.authorityId !== 'string' ||
    typeof value.subjectId !== 'string' ||
    value.category !== category
  )
    return undefined;
  const criterion =
    ALL_QUALIFICATION_CRITERIA.find((c) => c === value.criterion) ?? null;
  if (
    category === 'EVIDENCE' || category === 'EXEMPTION'
      ? criterion === null
      : value.criterion !== null
  )
    return undefined;
  return {
    bytes: Buffer.from(value.bytes),
    signatureBase64: value.signatureBase64,
    algorithm: value.algorithm,
    keyId: value.keyId,
    authorityId: value.authorityId,
    subjectId: value.subjectId,
    category,
    criterion,
  };
}
export function recordClaims(
  value: unknown,
  category: 'EVIDENCE' | 'EXEMPTION',
): ClaimedRecordDocument[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const results: ClaimedRecordDocument[] = [];
  for (const item of value) {
    if (!isObject(item) || !onlyKeys(item, ['record', 'document']))
      return undefined;
    const document = documentClaim(item.document, category);
    if (!document) return undefined;
    results.push({ record: jsonSnapshot(item.record), document });
  }
  // Sorting by the entire signed identity + bytes also makes duplicate-ID errors
  // deterministic; no caller index is used as a subject identity.
  return results.sort((a, b) => {
    const key = (r: ClaimedRecordDocument) =>
      canonicalJson({
        record: r.record,
        document: {
          ...r.document,
          bytes: Buffer.from(r.document.bytes ?? []).toString('base64'),
        },
      });
    const left = key(a),
      right = key(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
/** Read only AFTER graph verification. This extracts metadata omitted from the
 * existing identity snapshot, without manufacturing another graph receipt. */
export function graphEdgeMetadata(
  bytes: Uint8Array,
  representation: 'JSON' | 'JSON.GZ',
  edgeId: string,
): unknown {
  const graph = parseJsonBytes(
    representation === 'JSON.GZ'
      ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
      : bytes,
  );
  if (!isObject(graph) || !Array.isArray(graph.edges)) return undefined;
  const edge: unknown = graph.edges.find(
    (e: unknown) => isObject(e) && e.id === edgeId,
  );
  return isObject(edge) ? edge.metadata : undefined;
}
function emptyProfile(): RescueVehicleProfile {
  return {
    profileId: '',
    profileName: '',
    profileVersion: '',
    status: 'PROVISIONAL_DEVELOPMENT',
    overallHeightMeters: 0,
    overallWidthMeters: 0,
    overallLengthMeters: 0,
    grossWeightTons: 0,
    maxAxleWeightTons: 0,
    groundClearanceMeters: 0,
    fordingDepthMeters: 0,
    turningRadiusMeters: 0,
    maxClimbGradientPercent: 0,
    approachAngleDegrees: 0,
    departureAngleDegrees: 0,
    verticalMarginMeters: 0,
    horizontalMarginMeters: 0,
    loadSafetyFactor: 0,
    allowedHighwayTypes: [],
    disallowedSurfaceTypes: [],
    allowsBridges: false,
    allowsTunnels: false,
    approvalProvenance: {
      issuingAuthority: '',
      authorityRegistryCode: '',
      documentTitle: '',
      documentReferenceNumber: '',
      documentSha256: '',
      profileVersion: '',
      issuedAt: '',
      effectiveFrom: '',
      effectiveUntil: '',
      approvingOfficerName: '',
      approvingOfficerRole: '',
      verificationMethod: 'UNVERIFIED_DEVELOPMENT_PROTOTYPE',
      digitalSignatureStatus: 'UNVERIFIED_NOT_CONFIGURED',
      revocationStatus: 'ACTIVE',
    },
  };
}
/** Typed diagnostic projection; conservative metadata defaults are never used
 * to verify exemptions. Invalid/missing inputs still exercise the locked engine. */
export function diagnosticInput(
  edge: GraphEdgeIdentity | undefined,
  profile: unknown,
  evidenceRecords: readonly CriterionEvidenceRecord[],
  notApplicableRecords: readonly NotApplicableEvidenceRecord[],
  evaluatedAt: string,
  graphVersion: string,
  graphArtifactSha256: string,
  requireProductionApproved?: boolean,
) {
  const roadEdge: RoadEdge = {
    id: edge?.id ?? '',
    osmWayId: edge?.osmWayId ?? 0,
    fromNodeId: edge?.fromNodeId ?? '',
    toNodeId: edge?.toNodeId ?? '',
    isWayForward: edge?.isWayForward ?? false,
    lengthMeters: edge?.lengthMeters ?? 0,
    geometry: edge?.geometry.map((p) => ({ ...p })) ?? [],
    wayFlowPolicy: 'UNKNOWN',
    compatibilityStatus: 'UNVERIFIED',
    isEligibleForStrictRouting: false,
    metadata: {
      name: '',
      highwayType: '',
      surface: '',
      smoothness: '',
      widthMeters: null,
      effectiveWidthMeters: null,
      maxWidthMeters: null,
      maxPhysicalWidthMeters: null,
      maxHeightMeters: null,
      maxPhysicalHeightMeters: null,
      maxWeightTons: null,
      maxWeightRatingTons: null,
      maxAxleLoadTons: null,
      maxSpeedKmH: null,
      bridge: true,
      tunnel: true,
      layer: 0,
      rawTags: {},
    },
  };
  return {
    edge: roadEdge,
    vehicleProfile: validateVehicleProfile(profile).value ?? emptyProfile(),
    evidenceRecords,
    notApplicableRecords,
    evaluatedAt,
    graphVersion,
    graphArtifactSha256,
    requireProductionApproved,
  };
}
