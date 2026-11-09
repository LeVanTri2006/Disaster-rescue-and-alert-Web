import { CriterionEvidenceRecord, NotApplicableEvidenceRecord, QualificationCriterion, RescueVehicleProfile, GEOMETRY_HASH_VERSION, QUALIFICATION_POLICY_VERSION, ALL_QUALIFICATION_CRITERIA } from '../src/qualification-types';
import { CRITERION_UNITS } from '../src/qualification-validation';
import { RoadEdge } from '../src/types';
import { computeCanonicalEdgeGeometryHash } from '../src/qualification-geometry';
import { EdgeQualificationInput } from '../src/edge-qualifier';
export const GRAPH_SHA256 = '1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4';
let fixtureSequence = 0;
export function createMockRescueTruckProfile(
  overrides?: Partial<RescueVehicleProfile>,
): RescueVehicleProfile {
  return {
    profileId: 'RESCUE_TRUCK_4X4_DN_TYPE_A',
    profileName: 'Xe Cứu Nạn Chữa Cháy 4x4 Đô Thị Hạng Nhẹ',
    profileVersion: '1.0.0',
    status: 'ACTIVE_APPROVED',
    overallHeightMeters: 3.0,
    overallWidthMeters: 2.2,
    overallLengthMeters: 6.0,
    grossWeightTons: 5.0,
    maxAxleWeightTons: 3.0,
    groundClearanceMeters: 0.35,
    fordingDepthMeters: 0.8,
    turningRadiusMeters: 6.5,
    maxClimbGradientPercent: 30.0,
    approachAngleDegrees: 35.0,
    departureAngleDegrees: 30.0,
    verticalMarginMeters: 0.1,    // Required height clearance = 3.10m
    horizontalMarginMeters: 0.2,  // Required width clearance = 2.40m
    loadSafetyFactor: 1.05,       // Required structural load = 5.25t
    allowedHighwayTypes: [
      'motorway',
      'trunk',
      'primary',
      'secondary',
      'tertiary',
      'residential',
      'unclassified',
    ].sort(),
    disallowedSurfaceTypes: ['clay', 'mud', 'sand'],
    allowsBridges: true,
    allowsTunnels: true,
    approvalProvenance: {
      issuingAuthority: 'Phòng Cảnh sát PCCC & CNCH - CA TP Đà Nẵng',
      authorityRegistryCode: 'SO_GTVT_DANANG',
      documentTitle: 'Quyết định ban hành tiêu chuẩn phương tiện cứu nạn',
      documentReferenceNumber: 'QD-2026-PCCC-01',
      documentSha256:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      profileVersion: '1.0.0',
      issuedAt: '2026-01-01T00:00:00Z',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveUntil: '2027-12-31T23:59:59Z',
      approvingOfficerName: 'Nguyễn Văn A',
      approvingOfficerRole: 'Trưởng phòng',
      verificationMethod: 'DIGITAL_SIGNATURE_X509',
      digitalSignatureStatus: 'VERIFIED_TRUSTED',
      revocationStatus: 'ACTIVE',
    },
    ...overrides,
  };
}

export function createMockEdge(params?: Partial<RoadEdge>): RoadEdge {
  const defaultGeometry = [
    { lat: 16.065, lon: 108.215 },
    { lat: 16.066, lon: 108.216 },
  ];
  return {
    id: 'EDGE_N1_N2_FWD',
    osmWayId: 1001,
    fromNodeId: 'N1',
    toNodeId: 'N2',
    isWayForward: true,
    lengthMeters: 120.0,
    geometry: defaultGeometry,
    wayFlowPolicy: 'FORWARD',
    metadata: {
      name: 'Đường Nguyễn Văn Linh',
      highwayType: 'primary',
      surface: 'asphalt',
      smoothness: 'good',
      widthMeters: 14.0,
      effectiveWidthMeters: 12.0,
      maxWidthMeters: null,
      maxPhysicalWidthMeters: null,
      maxHeightMeters: null,
      maxPhysicalHeightMeters: null,
      maxWeightTons: null,
      maxWeightRatingTons: null,
      maxAxleLoadTons: null,
      maxSpeedKmH: 50,
      bridge: false,
      tunnel: false,
      layer: 0,
      rawTags: { highway: 'primary', surface: 'asphalt' },
    },
    compatibilityStatus: 'UNVERIFIED',
    isEligibleForStrictRouting: false,
    ...params,
  };
}

export function createMockEvidence(
  params: Partial<CriterionEvidenceRecord> & {
    criterion: QualificationCriterion;
    edgeId: string;
    canonicalGeometryHash: string;
  },
): CriterionEvidenceRecord {
  // Automatically choose an authoritative whitelisted agency for the criterion if not overridden
  const defaultAuthorityByCriterion: Record<QualificationCriterion, string> = {
    LEGAL_ACCESS: 'SO_GTVT_DANANG',
    PHYSICAL_HEIGHT_CLEARANCE: 'TT_QUAN_LY_HA_TANG_DANANG',
    PHYSICAL_WIDTH_CLEARANCE: 'TT_QUAN_LY_HA_TANG_DANANG',
    STRUCTURAL_LOAD_CAPACITY: 'TT_QUAN_LY_HA_TANG_DANANG',
    AXLE_LOAD_CAPACITY: 'TT_QUAN_LY_HA_TANG_DANANG',
    SURFACE_SUITABILITY: 'BAN_QLDA_DUY_TU_DUONG_BO_DANANG',
    GEOMETRIC_FEASIBILITY: 'SO_GTVT_DANANG',
    STATIC_TERRAIN_CAPABILITY: 'SO_GTVT_DANANG',
  };

  return {
    evidenceId: `EVID-${++fixtureSequence}`,
    geometryHashVersion: GEOMETRY_HASH_VERSION,
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
    graphVersion: 'dn_central_real_v1',
    graphArtifactSha256: GRAPH_SHA256,
    sourceAuthorityId: defaultAuthorityByCriterion[params.criterion],
    sourceDocumentRef: 'DOC-SURVEY-2026-01',
    documentSha256:
      'c1c2c3c4c5c6c1c2c3c4c5c6c1c2c3c4c5c6c1c2c3c4c5c6c1c2c3c4c5c6c1c2',
    measuredValue: 4.5,
    measurementUncertainty: 0.05,
    unit: CRITERION_UNITS[params.criterion],
    stringValue: params.criterion === 'SURFACE_SUITABILITY' ? 'asphalt' : undefined,
    booleanValue: true,
    spatialScope: {
      scopeType: 'CONTINUOUS_FULL_EDGE',
    },
    evaluatedAt: '2026-05-01T00:00:00Z',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    revocationStatus: 'ACTIVE',
    digitalSignatureStatus: 'VERIFIED_TRUSTED',
    ...params,
  };
}

export function createMockNotApplicableEvidence(
  params: Partial<NotApplicableEvidenceRecord> & {
    criterion: QualificationCriterion;
    edgeId: string;
    canonicalGeometryHash: string;
  },
): NotApplicableEvidenceRecord {
  return {
    evidenceId: `EXEMPT-${++fixtureSequence}`,
    geometryHashVersion: GEOMETRY_HASH_VERSION,
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
    graphVersion: 'dn_central_real_v1',
    graphArtifactSha256: GRAPH_SHA256,
    sourceAuthorityId: 'SO_GTVT_DANANG',
    justificationCode: 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE',
    technicalJustificationDetails: 'Đường trên nền đất đắp tự nhiên, không có cầu cống',
    referenceCadastreMapNumber: 'BAN_DO_DIA_CHINH_TO_42_DN',
    documentSha256:
      'd1d2d3d4d5d6d1d2d3d4d5d6d1d2d3d4d5d6d1d2d3d4d5d6d1d2d3d4d5d6d1d2',
    verifiedAt: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    revocationStatus: 'ACTIVE',
    digitalSignatureStatus: 'VERIFIED_TRUSTED',
    ...params,
  };
}


/** Complete schema-valid 8/8 diagnostic baseline. No fixture establishes trust. */
export function createCompleteInput(): EdgeQualificationInput {
  const edge = createMockEdge();
  const hash = computeCanonicalEdgeGeometryHash(edge);
  const values = [1, 4.5, 4, 20, 10, 1, 5, 0.1];
  return {
    edge, graphVersion: 'dn_central_real_v1', graphArtifactSha256: GRAPH_SHA256,
    vehicleProfile: createMockRescueTruckProfile(), evaluatedAt: '2026-06-01T00:00:00Z',
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION, requireProductionApproved: true,
    evidenceRecords: ALL_QUALIFICATION_CRITERIA.map((criterion, i) => createMockEvidence({
      criterion, edgeId: edge.id, canonicalGeometryHash: hash, evidenceId: `BASE-${i}`, measuredValue: values[i],
    })),
  };
}
