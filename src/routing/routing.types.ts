export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  bufferedMeters?: number;
}

export type StrictRoutingReadiness =
  | 'READY'
  | 'NOT_READY_UNRESOLVED_RESTRICTIONS'
  | 'NOT_READY_NO_VERIFIED_EDGES'
  | 'NOT_READY_HAS_UNVERIFIED_EDGES';

export interface EdgeSafetySummary {
  totalEdges: number;
  verifiedCompatibleEdges: number;
  unverifiedEdges: number;
  blockedEdges: number;
  conflictedEdges: number;
  strictSafeEdgesPercent: number;
  blockedWays: number;
  excludedBlockedWays?: number;
  retainedBlockedWays?: number;
}

export interface RoutingBundleInfo {
  fileName: string;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  sha256: string;
}

export interface UnsupportedRestrictionsSummary {
  totalCount: number;
  enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE';
}

export interface RoutingManifest {
  $schema?: string;
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
  bundle: RoutingBundleInfo;
  activeHazardSnapshotVersion: string | null;
  hazardSnapshotStatus: 'NOT_INCLUDED' | 'ATTACHED';
  hazardAssessmentPolicy: string;

  // Turn restriction status:
  isRestrictionStrictRoutingEligible: boolean;
  restrictionStrictRoutingReadiness: StrictRoutingReadiness;
  unsupportedRestrictionsSummary: UnsupportedRestrictionsSummary;

  // Strict routing readiness:
  canAttemptStrictRouting: boolean;
  isStrictRoutingEligible?: boolean;
  overallStrictRoutingReadiness: StrictRoutingReadiness;
  strictRoutingReadiness?: StrictRoutingReadiness;

  // Edge safety data summary:
  edgeSafetySummary: EdgeSafetySummary;
}

export interface GraphDownloadInfo {
  url: string;
  expiresIn: number;
}

export interface RoutingStatusResponse {
  manifest: RoutingManifest;
  download: GraphDownloadInfo;
  downloadAvailable: boolean;
  strictRoutingReady: boolean;
  liveHazardReady: boolean;
  canAttemptStrictRouting: boolean;
  overallStrictRoutingReadiness: StrictRoutingReadiness;
}
