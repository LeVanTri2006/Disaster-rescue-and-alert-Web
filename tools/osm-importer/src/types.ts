export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  bufferedMeters?: number;
}

export const DA_NANG_CENTRAL_PRODUCTION_BOUNDING_BOX: BoundingBox = {
  minLon: 108.1900,
  minLat: 16.0350,
  maxLon: 108.2350,
  maxLat: 16.0750,
  bufferedMeters: 500.0,
};

export const FIXTURE_BOUNDING_BOX: BoundingBox = {
  minLon: 108.1100,
  minLat: 16.0100,
  maxLon: 108.2000,
  maxLat: 16.0960,
  bufferedMeters: 500.0,
};

export interface RoadNode {
  id: string;
  osmNodeId: number | null;
  lat: number;
  lon: number;
  isSynthetic: boolean;
}

export type WayFlowPolicy =
  | 'FORWARD'
  | 'REVERSE'
  | 'BIDIRECTIONAL'
  | 'CONDITIONAL'
  | 'REVERSIBLE'
  | 'ALTERNATING'
  | 'UNKNOWN';

export type EdgeCompatibilityStatus =
  | 'VERIFIED_COMPATIBLE'
  | 'UNVERIFIED'
  | 'BLOCKED';

export interface EdgeMetadata {
  name: string;
  highwayType: string;
  surface: string;
  smoothness: string;
  trackGrade?: string | null;
  surfaceSuitability?: string | null;

  // Width limits (strictly distinguished semantics)
  widthMeters: number | null;               // Physical road width (tag: width, est_width)
  effectiveWidthMeters: number | null;      // Effective usable travel width (tag: width:effective)
  maxWidthMeters: number | null;            // Legal maximum width sign (tag: maxwidth)
  maxPhysicalWidthMeters: number | null;    // Physical barrier/chokepoint width (tag: maxwidth:physical)

  // Height limits (strictly distinguished semantics)
  maxHeightMeters: number | null;           // Legal maximum height sign (tag: maxheight)
  maxPhysicalHeightMeters: number | null;   // Physical clearance height (tag: maxheight:physical)

  // Weight limits (strictly distinguished semantics)
  maxWeightTons: number | null;             // Actual loaded vehicle weight limit (tag: maxweight)
  maxWeightRatingTons: number | null;       // Registered/rated vehicle weight limit (tag: maxweightrating)
  maxAxleLoadTons: number | null;           // Axle load limit (tag: maxaxleload)

  maxSpeedKmH: number | null;
  bridge: boolean;
  tunnel: boolean;
  layer: number;
  rawTags: Record<string, string>;

  // Data verification, classification, and diagnostics
  isDimensionUnverified?: boolean;
  isPhysicalClearanceUnverified?: boolean;
  unverifiedPhysicalDimensions?: string[];
  unverifiedLegalRestrictions?: string[];
  tagConflicts?: string[];
  tagWarnings?: string[];
}

export interface RoadEdge {
  id: string;
  osmWayId: number;
  fromNodeId: string;
  toNodeId: string;
  isWayForward: boolean;
  lengthMeters: number;
  geometry: GeoPoint[];
  wayFlowPolicy: WayFlowPolicy;
  metadata: EdgeMetadata;

  // Edge-level compatibility and strict routing safety
  compatibilityStatus: EdgeCompatibilityStatus;
  isEligibleForStrictRouting: boolean;
  blockedReason?: string | null;
}

export interface OsmRelationMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  order: number;
}

export type TurnRestrictionType =
  | 'NO_LEFT_TURN'
  | 'NO_RIGHT_TURN'
  | 'NO_STRAIGHT_ON'
  | 'NO_U_TURN'
  | 'NO_ENTRY'
  | 'NO_EXIT'
  | 'ONLY_LEFT_TURN'
  | 'ONLY_RIGHT_TURN'
  | 'ONLY_STRAIGHT_ON'
  | 'ONLY_U_TURN';

export type RestrictionSupportStatus =
  | 'FULLY_SUPPORTED'
  | 'FAIL_CLOSED_UNRESOLVED'
  | 'UNVERIFIED_WARNING'
  | 'EXEMPT_FOR_PROFILE';

export interface EdgeTransition {
  fromEdgeId: string;
  toEdgeId: string;
  viaNodeId: string;
}

export interface TurnRestriction {
  id: string;
  type: TurnRestrictionType;
  members: OsmRelationMember[];
  fromOsmWayIds: number[];
  viaOsmNodeIds: number[];
  viaOsmWayIds: number[];
  toOsmWayIds: number[];
  restrictionMode: string | null;
  exceptModes: string[];
  conditionalExpression: string | null;
  supportStatus: RestrictionSupportStatus;
  isExemptForProfile?: boolean;
  validationError?: string | null;
  prohibitedTransitions?: EdgeTransition[];
  allowedTransitions?: EdgeTransition[];
}

export type StrictRoutingReadiness =
  | 'READY'
  | 'NOT_READY_UNRESOLVED_RESTRICTIONS'
  | 'NOT_READY_NO_VERIFIED_EDGES'
  | 'NOT_READY_HAS_UNVERIFIED_EDGES';

export interface EdgeSafetySummary {
  // Directed Edge statistics (unit = directed edges in road graph)
  totalEdges: number;
  verifiedCompatibleEdges: number;
  unverifiedEdges: number;
  blockedEdges: number; // Directed edges in graph with status BLOCKED
  conflictedEdges: number;
  strictSafeEdgesPercent: number; // Percentage of graph edges that are VERIFIED: (verifiedCompatibleEdges / totalEdges) * 100

  // OSM Way statistics (unit = OSM Ways)
  blockedWays: number; // Total number of OSM Ways evaluated as BLOCKED, whether retained or excluded
  excludedBlockedWays?: number; // Number of BLOCKED OSM Ways excluded from graph
  retainedBlockedWays?: number; // Number of BLOCKED OSM Ways retained in graph
}

export type CliMode = 'FIXTURE' | 'REAL_OSM_SNAPSHOT';

export interface BaseRoadGraph {
  $schema?: string;
  contractVersion: string;
  graphVersion: string;
  vehicleProfile: string;
  boundingBoxType?: 'FIXTURE' | 'PRODUCTION';
  boundingBox?: BoundingBox;

  // Turn restriction strict routing readiness:
  isRestrictionStrictRoutingEligible: boolean;
  restrictionStrictRoutingReadiness: StrictRoutingReadiness;

  // Strict routing eligibility on verified edges:
  canAttemptStrictRouting: boolean;
  isStrictRoutingEligible: boolean; // Backward-compatible alias for canAttemptStrictRouting

  // Overall graph data completeness readiness:
  overallStrictRoutingReadiness: StrictRoutingReadiness;
  strictRoutingReadiness: StrictRoutingReadiness; // Backward-compatible alias for overallStrictRoutingReadiness

  // Edge safety data summary:
  edgeSafetySummary: EdgeSafetySummary;

  osmSnapshotTimestamp?: string;
  fixtureGeneratedAt?: string;
  generatedAt?: string;
  nodes: RoadNode[];
  edges: RoadEdge[];
  turnRestrictions: TurnRestriction[];
}

export interface SafetyMargins {
  lateralMeters?: number;
  verticalMeters?: number;
}

export interface VehicleDimensions {
  heightMeters?: number;
  widthMeters?: number;
  lengthMeters?: number;
  actualWeightTons?: number;
  maxWeightRatingTons?: number;
  axleLoadTons?: number;
  weightTons?: number;
  safetyMarginMeters?: SafetyMargins;
}

export interface LegalExemptionPolicy {
  allowAccessRestrictionsOverride: boolean;
  allowLegalWidthSignOverride: boolean;
  allowLegalHeightSignOverride: boolean;
  allowLegalWeightRatingSignOverride: boolean;
}

export interface VehicleProfile {
  profileName: string;
  dimensions: VehicleDimensions;
  allowedHighwayTypes: Set<string>;
  emergencyExemptionEnabled: boolean;
  allowPrivateAccessOverride: boolean;
  legalExemptionPolicy?: LegalExemptionPolicy;
}

export interface DroppedItemReason {
  type: 'way' | 'relation' | 'edge';
  id: number | string;
  reason: string;
}

export interface ImportDiagnostics {
  nodesRead: number;
  waysRead: number;
  relationsRead: number;
  nodesCreated: number;
  directedEdgesCreated: number;
  onewayForwardCount: number;
  onewayReverseCount: number;
  bidirectionalWayCount: number;
  roundaboutCount: number;
  turnRestrictionsRead: number;
  supportedRestrictionsCount: number;
  unsupportedRestrictionsCount: number;
  exemptRestrictionsCount: number;
  invalidRelationsCount: number;
  invalidGeometryCount: number;
  missingNodeReferencesCount: number;
  droppedWaysCount: number;
  droppedEdgesCount: number;

  // Edge safety statistics:
  verifiedCompatibleEdgesCount: number;
  unverifiedEdgesCount: number;
  blockedEdgesCount: number; // Directed edges in graph with status BLOCKED
  blockedWaysCount: number;  // Total OSM Ways evaluated as BLOCKED
  excludedBlockedWaysCount: number; // OSM Ways evaluated as BLOCKED that were actually excluded from the graph
  retainedBlockedWaysCount: number; // OSM Ways evaluated as BLOCKED that were retained in the graph
  unverifiedDimensionsCount: number;
  tagConflictCount: number;
  tagWarningCount: number;

  droppedItems: DroppedItemReason[];
}

export interface RoutingManifest {
  $schema: string;
  manifestVersion: string;
  generatedAt: string;
  graphVersion: string;
  osmSnapshotTimestamp: string;
  fixtureGeneratedAt?: string;
  importerVersion: string;
  vehicleProfile: string;
  boundingBoxType: 'FIXTURE' | 'PRODUCTION';
  boundingBox?: BoundingBox;
  targetProductionBoundingBox?: BoundingBox;
  bundle: {
    fileName: string;
    compressedSizeBytes: number;
    uncompressedSizeBytes: number;
    sha256: string;
  };
  activeHazardSnapshotVersion: string | null;
  hazardSnapshotStatus: 'NOT_INCLUDED' | 'ATTACHED';
  hazardAssessmentPolicy: string;

  // Turn restriction status:
  isRestrictionStrictRoutingEligible: boolean;
  restrictionStrictRoutingReadiness: StrictRoutingReadiness;
  unsupportedRestrictionsSummary: {
    totalCount: number;
    enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE';
  };

  // Strict routing readiness:
  canAttemptStrictRouting: boolean;
  isStrictRoutingEligible: boolean; // Backward-compatible alias for canAttemptStrictRouting
  overallStrictRoutingReadiness: StrictRoutingReadiness;
  strictRoutingReadiness: StrictRoutingReadiness; // Backward-compatible alias for overallStrictRoutingReadiness

  // Edge safety data summary:
  edgeSafetySummary: EdgeSafetySummary;
}
