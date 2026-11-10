/**
 * Phase 5 - Task 5C.1: Qualification Engine Contracts & Data Types
 * Untrusted input contracts and locked diagnostic qualification results
 *
 * All string collections MUST be serializable as deterministic string[] (NO Set<string>).
 * Strictly typed, no 'any'.
 */


export const QUALIFICATION_POLICY_VERSION = '5C1R-locked-v1' as const;
export const GEOMETRY_HASH_VERSION = 'edge-geometry-v2-decimal-half-even' as const;

/** Requirements for a future trusted loader/verifier. This is NOT a credential,
 * is not accepted by qualifyEdge, and has no factory that can unlock production.
 * PKI, artifact membership/endpoint verification, survey coverage and a trusted
 * clock must all be implemented and audited before that API can be introduced.
 */
export interface ProductionTrustRequirements {
  readonly pkiVerification: 'REQUIRED';
  readonly artifactAndEndpointVerification: 'REQUIRED';
  readonly authoritativeCoverage: 'REQUIRED';
  readonly trustedClock: 'REQUIRED';
}

export interface EvidenceGraphBinding {
  readonly geometryHashVersion: typeof GEOMETRY_HASH_VERSION;
  readonly graphVersion: string;
  readonly graphArtifactSha256: string;
  readonly qualificationPolicyVersion: typeof QUALIFICATION_POLICY_VERSION;
}

// ============================================================================
// 1. DIGITAL SIGNATURE & PROVENANCE CONTRACTS
// ============================================================================

/** Payload declarations only. These labels are NEVER verifier credentials. */
export type DigitalSignatureVerificationStatus =
  | 'VERIFIED_TRUSTED'            // Valid X.509 signature chaining to government Root CA
  | 'UNVERIFIED_NOT_CONFIGURED'   // System PKI inspection not configured (default in dev)
  | 'INVALID_SIGNATURE'           // Mathematical signature mismatch or corrupted data
  | 'UNTRUSTED_ISSUER'            // Certificate issuer not in trusted government CA whitelist
  | 'EXPIRED_CERTIFICATE'         // Certificate expired at verification time
  | 'REVOKED_CERTIFICATE';        // Certificate revoked via CRL/OCSP

export type ApprovalVerificationMethod =
  | 'OFFICIAL_GOVERNMENT_GAZETTE'      // Published official gazette or decree
  | 'DIGITAL_SIGNATURE_X509'           // Standard X.509 digital signature
  | 'CERTIFIED_HARDCOPY_ARCHIVE'       // Notarized physical archived document
  | 'UNVERIFIED_DEVELOPMENT_PROTOTYPE';// Test/mock development prototype

export type RevocationStatus =
  | 'ACTIVE'
  | 'REVOKED_SAFETY_NOTICE';

export interface VehicleProfileApprovalProvenance {
  readonly issuingAuthority: string;              // e.g., "Phòng Cảnh sát PCCC & CNCH - CA TP Đà Nẵng"
  readonly authorityRegistryCode: string;         // Official registry or tax ID
  readonly documentTitle: string;                 // Title of approval decision
  readonly documentReferenceNumber: string;       // Document archive reference number
  readonly documentSha256: string;                // SHA-256 hex of original approval PDF
  readonly profileVersion: string;                // Associated vehicle profile version (SemVer)
  readonly issuedAt: string;                      // ISO 8601 UTC timestamp
  readonly effectiveFrom: string;                 // ISO 8601 UTC timestamp
  readonly effectiveUntil: string;                // ISO 8601 UTC timestamp
  readonly approvingOfficerName: string;          // Full name of authorized signatory
  readonly approvingOfficerRole: string;          // Official title/role
  readonly verificationMethod: ApprovalVerificationMethod;
  readonly digitalSignatureStatus: DigitalSignatureVerificationStatus;
  readonly revocationStatus: RevocationStatus;
  readonly supersedesProfileVersion?: string;     // Previous version superseded by this profile
}

// ============================================================================
// 2. AUTHORITATIVE RESCUE VEHICLE PROFILE
// ============================================================================

export type VehicleProfileStatus =
  | 'ACTIVE_APPROVED'             // Legally certified and approved for production rescue
  | 'PROVISIONAL_DEVELOPMENT'     // Uncertified engineering prototype (for regression test only)
  | 'REVOKED';                    // Explicitly revoked due to safety bulletin

export interface RescueVehicleProfile {
  readonly profileId: string;                     // e.g. "RESCUE_TRUCK_4X4_DN_TYPE_A"
  readonly profileName: string;                   // e.g. "Xe Cứu Nạn Chữa Cháy 4x4 Đô Thị Hạng Nhẹ"
  readonly profileVersion: string;                // SemVer, e.g. "1.0.0"
  readonly status: VehicleProfileStatus;

  // Physical Dimensions & Structural Capabilities
  readonly overallHeightMeters: number;           // Topmost point including lights/antennas
  readonly overallWidthMeters: number;            // Widest point including mirrors
  readonly overallLengthMeters: number;           // Front bumper to rear equipment
  readonly grossWeightTons: number;               // Total operational weight fully loaded
  readonly maxAxleWeightTons: number;             // Maximum weight on any single axle
  readonly groundClearanceMeters: number;         // Lowest structural point to road surface
  readonly fordingDepthMeters: number;            // Water wading capability without snorkel
  readonly turningRadiusMeters: number;           // Curb-to-curb turning radius
  readonly maxClimbGradientPercent: number;       // Maximum longitudinal grade ability (%)
  readonly approachAngleDegrees: number;          // Approach angle
  readonly departureAngleDegrees: number;         // Departure angle

  // Safety Margins
  readonly verticalMarginMeters: number;          // Overhead safety buffer (e.g. 0.10m)
  readonly horizontalMarginMeters: number;        // Lateral safety buffer (e.g. 0.20m)
  readonly loadSafetyFactor: number;              // Structural weight safety factor (e.g. 1.05)

  // Operational Constraints (NO Set<string>; deterministic sorted string[])
  readonly allowedHighwayTypes: readonly string[];     // Permitted highway classifications
  readonly disallowedSurfaceTypes: readonly string[];  // Unsuitable road surfaces
  readonly allowsBridges: boolean;                // Whether route may include bridge structures
  readonly allowsTunnels: boolean;                // Whether route may include tunnel structures

  // Legal and Technical Provenance
  readonly approvalProvenance: VehicleProfileApprovalProvenance;
}

// ============================================================================
// 3. QUALIFICATION CRITERIA & EVALUATION STATES
// ============================================================================

export type QualificationCriterion =
  | 'LEGAL_ACCESS'
  | 'PHYSICAL_HEIGHT_CLEARANCE'
  | 'PHYSICAL_WIDTH_CLEARANCE'
  | 'STRUCTURAL_LOAD_CAPACITY'
  | 'AXLE_LOAD_CAPACITY'
  | 'SURFACE_SUITABILITY'
  | 'GEOMETRIC_FEASIBILITY'
  | 'STATIC_TERRAIN_CAPABILITY';

export const ALL_QUALIFICATION_CRITERIA: readonly QualificationCriterion[] = [
  'LEGAL_ACCESS',
  'PHYSICAL_HEIGHT_CLEARANCE',
  'PHYSICAL_WIDTH_CLEARANCE',
  'STRUCTURAL_LOAD_CAPACITY',
  'AXLE_LOAD_CAPACITY',
  'SURFACE_SUITABILITY',
  'GEOMETRIC_FEASIBILITY',
  'STATIC_TERRAIN_CAPABILITY',
] as const;

/**
 * Tier 1: Per-measurement decision considering measurement uncertainty interval.
 */
export type EvidenceMeasurementDecision =
  | 'PASS_CERTAIN'      // Conservative bound strictly meets safety requirement
  | 'FAIL_CERTAIN'      // Conservative bound strictly violates safety requirement
  | 'INDETERMINATE';    // Uncertainty interval straddles safety threshold

/**
 * Tier 2: Synthesized state of a criterion on a road edge across all evidence records.
 */
export type CriterionEvaluationState =
  | 'SATISFIED'         // Valid unexpired evidence, full coverage, measurement PASS_CERTAIN
  | 'FAILED'            // Valid unexpired evidence proves FAIL_CERTAIN (leads to BLOCKED edge)
  | 'INDETERMINATE'     // Valid unexpired evidence with uncertainty overlapping threshold (remains UNVERIFIED)
  | 'NOT_APPLICABLE'    // Legally exempt with valid NotApplicableEvidenceRecord
  | 'MISSING'           // Completely lacking evidence or lacking spatial chokepoint coverage (remains UNVERIFIED)
  | 'CONFLICTING'       // Disjoint measurements from equal authorities at same location (remains UNVERIFIED)
  | 'EXPIRED'           // All evidence expired (validUntil < evaluatedAt) (remains UNVERIFIED)
  | 'INVALID';          // Evidence integrity corrupted, invalid uncertainty, or unauthorized source (remains UNVERIFIED)

// ============================================================================
// 4. EVIDENCE RECORD CONTRACTS
// ============================================================================

export type SpatialScopeType =
  | 'CONTINUOUS_FULL_EDGE'
  | 'POINT_CHOKEPOINT'
  | 'SECTION_SPAN';

export interface SpatialScope {
  readonly scopeType: SpatialScopeType;
  readonly offsetMeters?: number;           // Offset from start of edge in meters for POINT_CHOKEPOINT
  readonly fromOffsetMeters?: number;       // Start offset for SECTION_SPAN
  readonly toOffsetMeters?: number;         // End offset for SECTION_SPAN
  readonly locationDescription?: string;    // Human-readable chokepoint description
}

export interface CriterionEvidenceRecord extends EvidenceGraphBinding {
  readonly evidenceId: string;              // Opaque non-empty archive identifier
  readonly criterion: QualificationCriterion;
  readonly edgeId: string;                  // Target directed edge ID
  readonly canonicalGeometryHash: string;   // 64-char lowercase hex SHA-256 of edge geometry
  readonly sourceAuthorityId: string;       // Whitelisted authority code
  readonly sourceDocumentRef: string;       // Archive/gazette reference number
  readonly documentSha256: string;          // 64-char lowercase hex SHA-256 of source file
  readonly measuredValue: number;           // Measured quantity
  readonly measurementUncertainty: number;  // Measurement error margin (+/- delta > 0.0)
  readonly unit: string;                    // SI unit: 'm', 't', '%', 'boolean', 'enum'
  readonly booleanValue?: boolean;          // For boolean criteria (e.g. LEGAL_ACCESS)
  readonly stringValue?: string;            // For classification criteria (e.g. SURFACE_SUITABILITY)
  readonly spatialScope: SpatialScope;
  readonly evaluatedAt: string;             // ISO 8601 UTC
  readonly validFrom: string;               // ISO 8601 UTC
  readonly validUntil: string;              // ISO 8601 UTC
  readonly revocationStatus: 'ACTIVE' | 'REVOKED';
  readonly supersedesEvidenceId?: string;   // Previous evidence ID superseded by this record
  readonly digitalSignatureStatus: DigitalSignatureVerificationStatus;
}

export type ExemptionJustificationCode =
  | 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE'
  | 'GRADE_SEPARATED_STANDARD_HIGHWAY'
  | 'UNRESTRICTED_PUBLIC_EMERGENCY_CORRIDOR'
  | 'NO_OVERHEAD_STRUCTURE_OR_VEGETATION';

export interface NotApplicableEvidenceRecord extends EvidenceGraphBinding {
  readonly evidenceId: string;              // Opaque non-empty archive identifier
  readonly criterion: QualificationCriterion;
  readonly edgeId: string;
  readonly canonicalGeometryHash: string;   // 64-char lowercase hex SHA-256
  readonly sourceAuthorityId: string;
  readonly justificationCode: ExemptionJustificationCode;
  readonly technicalJustificationDetails: string;
  readonly referenceCadastreMapNumber: string;
  readonly documentSha256: string;          // 64-char lowercase hex SHA-256
  readonly verifiedAt: string;              // ISO 8601 UTC
  readonly validUntil: string;              // ISO 8601 UTC
  readonly revocationStatus: 'ACTIVE' | 'REVOKED';
  readonly digitalSignatureStatus: DigitalSignatureVerificationStatus;
}

// ============================================================================
// 5. QUALIFICATION SYNTHESIS & SIDE-CAR BUNDLE CONTRACTS
// ============================================================================

export interface CriterionEvaluationResult {
  readonly criterion: QualificationCriterion;
  readonly state: CriterionEvaluationState;
  /** Unauthenticated technical assessment; never authorizes routing. */
  readonly untrustedAssessmentState?: CriterionEvaluationState;
  readonly measurementDecision?: EvidenceMeasurementDecision;
  readonly effectiveValue?: number;
  readonly representativeUncertainty?: number;
  readonly effectiveValidUntil?: string;
  readonly evidenceIdsUsed: readonly string[];
  readonly diagnosticReasons: readonly string[];
}

export interface EdgeQualificationRecord {
  readonly purpose: 'DIAGNOSTIC_ONLY';
  readonly trustStatus: 'UNAVAILABLE';
  readonly geometryHashVersion: typeof GEOMETRY_HASH_VERSION;
  readonly qualificationPolicyVersion: typeof QUALIFICATION_POLICY_VERSION;
  readonly edgeId: string;
  readonly canonicalGeometryHash: string;
  readonly graphVersion: string;
  readonly graphArtifactSha256: string;
  readonly targetVehicleProfileId: string;
  readonly targetVehicleProfileVersion: string;
  readonly qualificationStatus: 'UNVERIFIED'; // Locked diagnostic API; no production certificate is emitted.
  readonly criteriaResults: Record<QualificationCriterion, CriterionEvaluationResult>;
  readonly overallEvaluationTimestamp: string;
  readonly earliestExpirationTimestamp?: string;
  readonly isProductionApproved: false;
  readonly qualificationErrors: readonly string[];
  readonly qualificationWarnings: readonly string[];
}

export interface RescueCorridorBundle {
  readonly corridorId: string;              // e.g. "CORRIDOR-DN-TRUCTHONG-01"
  readonly corridorName: string;            // e.g. "Trục Cứu hộ Huyết mạch: Nguyễn Văn Linh - Cầu Rồng"
  readonly corridorVersion: string;         // SemVer "1.0.0"

  // Graph and Vehicle Profile Bindings
  readonly graphVersion: string;
  readonly graphArtifactSha256: string;
  readonly qualificationSidecarSha256: string;
  readonly targetVehicleProfileId: string;
  readonly targetVehicleProfileVersion: string;

  // Explicit Authorized Edges (sorted unique array, NO Set)
  readonly authorizedEdgeIds: readonly string[];

  // Spatial Bounding Box
  readonly corridorBoundingBox: {
    readonly minLat: number;
    readonly minLon: number;
    readonly maxLat: number;
    readonly maxLon: number;
  };

  // Legal Issuance
  readonly issuingAuthority: string;
  readonly approvalDocumentReference: string;
  readonly approvalDocumentSha256: string;
  readonly validFrom: string;
  readonly validUntil: string;
}

// ============================================================================
// 6. AUTHORITY WHITELIST & EXEMPTION POLICY CONSTANTS
// ============================================================================

export const CRITERIA_NEVER_EXEMPTIBLE: readonly QualificationCriterion[] = [
  'LEGAL_ACCESS',
  'PHYSICAL_HEIGHT_CLEARANCE',
  'PHYSICAL_WIDTH_CLEARANCE',
  'SURFACE_SUITABILITY',
  'GEOMETRIC_FEASIBILITY',
] as const;

export const CRITERIA_EXEMPTIBLE_WITH_PROOF: readonly QualificationCriterion[] = [
  'STRUCTURAL_LOAD_CAPACITY',
  'AXLE_LOAD_CAPACITY',
  'STATIC_TERRAIN_CAPABILITY',
] as const;

export const AUTHORIZED_AUTHORITIES_BY_CRITERION: Record<
  QualificationCriterion,
  readonly string[]
> = {
  LEGAL_ACCESS: [
    'SO_GTVT_DANANG',
    'CONG_AN_TP_DANANG',
    'CUC_DUONG_BO_VN',
    'UBND_TP_DANANG',
  ],
  PHYSICAL_HEIGHT_CLEARANCE: [
    'TT_QUAN_LY_HA_TANG_DANANG',
    'VIEN_KHCN_GTVT',
    'DON_VI_KHAO_SAT_TRAC_DIA_CERTIFIED',
    'PHONG_CS_PCCC_CNCH_DANANG',
  ],
  PHYSICAL_WIDTH_CLEARANCE: [
    'TT_QUAN_LY_HA_TANG_DANANG',
    'SO_XAY_DUNG_DANANG',
    'DON_VI_KHAO_SAT_TRAC_DIA_CERTIFIED',
    'PHONG_CS_PCCC_CNCH_DANANG',
  ],
  STRUCTURAL_LOAD_CAPACITY: [
    'TT_QUAN_LY_HA_TANG_DANANG',
    'SO_GTVT_DANANG',
    'VIEN_KHCN_GTVT',
    'TRUNG_TAM_KIEM_DINH_CLCT_GTVT',
  ],
  AXLE_LOAD_CAPACITY: [
    'TT_QUAN_LY_HA_TANG_DANANG',
    'SO_GTVT_DANANG',
    'VIEN_KHCN_GTVT',
    'TRUNG_TAM_KIEM_DINH_CLCT_GTVT',
  ],
  SURFACE_SUITABILITY: [
    'BAN_QLDA_DUY_TU_DUONG_BO_DANANG',
    'SO_GTVT_DANANG',
    'PHONG_CS_PCCC_CNCH_DANANG',
  ],
  GEOMETRIC_FEASIBILITY: [
    'VIEN_QUY_HOACH_XAY_DUNG_DANANG',
    'SO_GTVT_DANANG',
    'DON_VI_TU_VAN_THIET_KE_GTVT_CERTIFIED',
  ],
  STATIC_TERRAIN_CAPABILITY: [
    'BAN_QLDA_GIAO_THONG_DANANG',
    'SO_GTVT_DANANG',
    'DON_VI_KHAO_SAT_TRAC_DIA_CERTIFIED',
  ],
} as const;

