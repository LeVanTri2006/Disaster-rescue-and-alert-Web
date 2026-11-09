import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { RoutingStorageService } from './storage/routing-storage.service';
import {
  RoutingManifest,
  RoutingStatusResponse,
  StrictRoutingReadiness,
} from './routing.types';

const EXPECTED_MANIFEST_VERSION = '2.1.0';
const EXPECTED_BUNDLE_FILE_NAME = 'BaseRoadGraph.json.gz';
const SHA256_REGEX = /^[a-f0-9]{64}$/;
const GRAPH_VERSION_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// One immutable decision for every response field until authoritative verification exists.
const DOWNLOAD_ONLY_READINESS = Object.freeze({
  strictRoutingReady: false,
  liveHazardReady: false,
  canAttemptStrictRouting: false,
  overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
} as const);

const VALID_READINESS_STATES: ReadonlySet<StrictRoutingReadiness> = new Set([
  'READY',
  'NOT_READY_UNRESOLVED_RESTRICTIONS',
  'NOT_READY_NO_VERIFIED_EDGES',
  'NOT_READY_HAS_UNVERIFIED_EDGES',
]);

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly storageService: RoutingStorageService) {}

  /**
   * Retrieves the current validated routing manifest and generates a presigned download URL.
   * Differentiates three explicit lifecycle states:
   * 1. downloadAvailable: true when manifest is valid and download URL generated.
   * 2. Strict routing stays unavailable: no production-authoritative verifier is integrated.
   * 3. Attached hazard metadata alone cannot establish live hazard readiness.
   */
  async getCurrentRouting(): Promise<RoutingStatusResponse> {
    const rawManifest = await this.storageService.getCurrentManifest();
    const validatedManifest = this.validateManifest(rawManifest);
    const manifest = this.downloadOnlyManifest(validatedManifest);

    const download = await this.storageService.createGraphDownloadUrl(
      manifest.graphVersion,
      manifest.bundle.compressedSizeBytes,
    );

    const downloadAvailable = true;

    return {
      manifest,
      download,
      downloadAvailable,
      ...DOWNLOAD_ONLY_READINESS,
    };
  }

  /** A response view only; never rewrite the stored manifest or graph bytes. */
  private downloadOnlyManifest(m: RoutingManifest): RoutingManifest {
    // These are unverified claims, even if internally consistent or hash-matched.
    // There is deliberately no flag, environment setting or TEST_ONLY receipt override.
    if (
      m.canAttemptStrictRouting !== false ||
      (m.isStrictRoutingEligible !== undefined &&
        m.isStrictRoutingEligible !== false) ||
      m.overallStrictRoutingReadiness === 'READY' ||
      (m.strictRoutingReadiness !== undefined &&
        (!VALID_READINESS_STATES.has(m.strictRoutingReadiness) ||
          m.strictRoutingReadiness === 'READY')) ||
      m.edgeSafetySummary.verifiedCompatibleEdges > 0 ||
      m.edgeSafetySummary.strictSafeEdgesPercent > 0
    ) {
      throw new InternalServerErrorException(
        'Production strict routing verification is unavailable; manifest readiness claims cannot be accepted',
      );
    }

    // Enumerate the response contract, rather than forwarding unknown approval/provider claims.
    // Clone nested metadata as well so neither the response nor its caller can mutate storage.
    const box = (value: RoutingManifest['boundingBox']) =>
      value && {
        minLon: value.minLon,
        minLat: value.minLat,
        maxLon: value.maxLon,
        maxLat: value.maxLat,
        bufferedMeters: value.bufferedMeters,
      };
    return structuredClone({
      $schema: m.$schema,
      manifestVersion: m.manifestVersion,
      generatedAt: m.generatedAt,
      graphVersion: m.graphVersion,
      osmSnapshotTimestamp: m.osmSnapshotTimestamp,
      fixtureGeneratedAt: m.fixtureGeneratedAt,
      importerVersion: m.importerVersion,
      vehicleProfile: m.vehicleProfile,
      boundingBoxType: m.boundingBoxType,
      boundingBox: box(m.boundingBox),
      targetProductionBoundingBox: box(m.targetProductionBoundingBox),
      bundle: {
        fileName: m.bundle.fileName,
        compressedSizeBytes: m.bundle.compressedSizeBytes,
        uncompressedSizeBytes: m.bundle.uncompressedSizeBytes,
        sha256: m.bundle.sha256,
      },
      activeHazardSnapshotVersion: m.activeHazardSnapshotVersion,
      hazardSnapshotStatus: m.hazardSnapshotStatus,
      hazardAssessmentPolicy: m.hazardAssessmentPolicy,
      isRestrictionStrictRoutingEligible:
        DOWNLOAD_ONLY_READINESS.canAttemptStrictRouting,
      restrictionStrictRoutingReadiness:
        DOWNLOAD_ONLY_READINESS.overallStrictRoutingReadiness,
      unsupportedRestrictionsSummary: {
        totalCount: m.unsupportedRestrictionsSummary.totalCount,
        enforcementPolicy: m.unsupportedRestrictionsSummary.enforcementPolicy,
      },
      canAttemptStrictRouting: DOWNLOAD_ONLY_READINESS.canAttemptStrictRouting,
      isStrictRoutingEligible: DOWNLOAD_ONLY_READINESS.canAttemptStrictRouting,
      overallStrictRoutingReadiness:
        DOWNLOAD_ONLY_READINESS.overallStrictRoutingReadiness,
      strictRoutingReadiness:
        DOWNLOAD_ONLY_READINESS.overallStrictRoutingReadiness,
      edgeSafetySummary: {
        totalEdges: m.edgeSafetySummary.totalEdges,
        verifiedCompatibleEdges: m.edgeSafetySummary.verifiedCompatibleEdges,
        unverifiedEdges: m.edgeSafetySummary.unverifiedEdges,
        blockedEdges: m.edgeSafetySummary.blockedEdges,
        conflictedEdges: m.edgeSafetySummary.conflictedEdges,
        strictSafeEdgesPercent: m.edgeSafetySummary.strictSafeEdgesPercent,
        blockedWays: m.edgeSafetySummary.blockedWays,
        excludedBlockedWays: m.edgeSafetySummary.excludedBlockedWays,
        retainedBlockedWays: m.edgeSafetySummary.retainedBlockedWays,
      },
    });
  }

  /**
   * Alias for getCurrentRouting() for consistency across caller conventions.
   */
  async getRoutingStatus(): Promise<RoutingStatusResponse> {
    return this.getCurrentRouting();
  }

  /**
   * Validates that an arbitrary JSON object conforms to the RoutingManifest contract v2.1.0.
   * Rejects missing fields, invalid checksums, impossible metrics, or malformed schemas.
   * Never fabricates default values for critical fields.
   */
  validateManifest(data: unknown): RoutingManifest {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new InternalServerErrorException(
        'Routing manifest must be a non-null object',
      );
    }

    const m = data as Record<string, unknown>;

    // 1. Contract version check
    if (m.manifestVersion !== EXPECTED_MANIFEST_VERSION) {
      throw new InternalServerErrorException(
        `Invalid or unsupported routing manifest version: expected ${EXPECTED_MANIFEST_VERSION}, got ${String(m.manifestVersion)}`,
      );
    }

    // 2. graphVersion
    if (
      typeof m.graphVersion !== 'string' ||
      !GRAPH_VERSION_REGEX.test(m.graphVersion)
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing graphVersion in routing manifest',
      );
    }

    // 3. Timestamps
    if (
      typeof m.generatedAt !== 'string' ||
      m.generatedAt.trim().length === 0 ||
      Number.isNaN(Date.parse(m.generatedAt))
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing generatedAt timestamp in routing manifest',
      );
    }

    if (
      typeof m.osmSnapshotTimestamp !== 'string' ||
      m.osmSnapshotTimestamp.trim().length === 0 ||
      Number.isNaN(Date.parse(m.osmSnapshotTimestamp))
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing osmSnapshotTimestamp in routing manifest',
      );
    }

    // 4. Importer version and vehicle profile
    if (
      typeof m.importerVersion !== 'string' ||
      m.importerVersion.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing importerVersion in routing manifest',
      );
    }

    if (
      typeof m.vehicleProfile !== 'string' ||
      m.vehicleProfile.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing vehicleProfile in routing manifest',
      );
    }

    // 5. Bounding box type
    if (m.boundingBoxType !== 'FIXTURE' && m.boundingBoxType !== 'PRODUCTION') {
      throw new InternalServerErrorException(
        'Invalid or missing boundingBoxType in routing manifest',
      );
    }

    // 6. Bundle validation
    if (!m.bundle || typeof m.bundle !== 'object' || Array.isArray(m.bundle)) {
      throw new InternalServerErrorException(
        'Missing bundle object in routing manifest',
      );
    }

    const bundle = m.bundle as Record<string, unknown>;

    if (bundle.fileName !== EXPECTED_BUNDLE_FILE_NAME) {
      throw new InternalServerErrorException(
        `Invalid bundle fileName in routing manifest: expected ${EXPECTED_BUNDLE_FILE_NAME}`,
      );
    }

    if (
      typeof bundle.compressedSizeBytes !== 'number' ||
      !Number.isSafeInteger(bundle.compressedSizeBytes) ||
      bundle.compressedSizeBytes <= 0
    ) {
      throw new InternalServerErrorException(
        'Invalid compressedSizeBytes in routing manifest bundle',
      );
    }

    if (
      typeof bundle.uncompressedSizeBytes !== 'number' ||
      !Number.isSafeInteger(bundle.uncompressedSizeBytes) ||
      bundle.uncompressedSizeBytes <= 0 ||
      bundle.uncompressedSizeBytes < bundle.compressedSizeBytes
    ) {
      throw new InternalServerErrorException(
        'Invalid uncompressedSizeBytes in routing manifest bundle',
      );
    }

    if (
      typeof bundle.sha256 !== 'string' ||
      !SHA256_REGEX.test(bundle.sha256)
    ) {
      throw new InternalServerErrorException(
        'Invalid or malformed sha256 checksum in routing manifest bundle',
      );
    }

    // 7. Hazard snapshot status and version
    if (
      m.hazardSnapshotStatus !== 'NOT_INCLUDED' &&
      m.hazardSnapshotStatus !== 'ATTACHED'
    ) {
      throw new InternalServerErrorException(
        'Invalid hazardSnapshotStatus in routing manifest',
      );
    }

    if (m.hazardSnapshotStatus === 'ATTACHED') {
      if (
        typeof m.activeHazardSnapshotVersion !== 'string' ||
        m.activeHazardSnapshotVersion.trim().length === 0
      ) {
        throw new InternalServerErrorException(
          'activeHazardSnapshotVersion must be specified when hazardSnapshotStatus is ATTACHED',
        );
      }
    } else {
      if (
        m.activeHazardSnapshotVersion !== null &&
        m.activeHazardSnapshotVersion !== undefined
      ) {
        throw new InternalServerErrorException(
          'activeHazardSnapshotVersion must be null when hazardSnapshotStatus is NOT_INCLUDED',
        );
      }
    }

    if (
      typeof m.hazardAssessmentPolicy !== 'string' ||
      m.hazardAssessmentPolicy.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        'Invalid or missing hazardAssessmentPolicy in routing manifest',
      );
    }

    // 8. Turn restriction status & summary
    if (typeof m.isRestrictionStrictRoutingEligible !== 'boolean') {
      throw new InternalServerErrorException(
        'Invalid isRestrictionStrictRoutingEligible in routing manifest',
      );
    }

    if (
      typeof m.restrictionStrictRoutingReadiness !== 'string' ||
      !VALID_READINESS_STATES.has(
        m.restrictionStrictRoutingReadiness as StrictRoutingReadiness,
      )
    ) {
      throw new InternalServerErrorException(
        'Invalid restrictionStrictRoutingReadiness in routing manifest',
      );
    }

    if (
      !m.unsupportedRestrictionsSummary ||
      typeof m.unsupportedRestrictionsSummary !== 'object' ||
      Array.isArray(m.unsupportedRestrictionsSummary)
    ) {
      throw new InternalServerErrorException(
        'Missing unsupportedRestrictionsSummary in routing manifest',
      );
    }

    const restrictionSummary = m.unsupportedRestrictionsSummary as Record<
      string,
      unknown
    >;

    if (
      typeof restrictionSummary.totalCount !== 'number' ||
      !Number.isSafeInteger(restrictionSummary.totalCount) ||
      restrictionSummary.totalCount < 0
    ) {
      throw new InternalServerErrorException(
        'Invalid unsupportedRestrictionsSummary.totalCount in routing manifest',
      );
    }

    if (restrictionSummary.enforcementPolicy !== 'FAIL_CLOSED_IN_STRICT_MODE') {
      throw new InternalServerErrorException(
        'Invalid unsupportedRestrictionsSummary.enforcementPolicy in routing manifest',
      );
    }

    // 9. Strict routing readiness and eligibility
    if (typeof m.canAttemptStrictRouting !== 'boolean') {
      throw new InternalServerErrorException(
        'Invalid canAttemptStrictRouting in routing manifest',
      );
    }

    if (
      typeof m.overallStrictRoutingReadiness !== 'string' ||
      !VALID_READINESS_STATES.has(
        m.overallStrictRoutingReadiness as StrictRoutingReadiness,
      )
    ) {
      throw new InternalServerErrorException(
        'Invalid overallStrictRoutingReadiness in routing manifest',
      );
    }

    // 10. Edge safety summary
    if (
      !m.edgeSafetySummary ||
      typeof m.edgeSafetySummary !== 'object' ||
      Array.isArray(m.edgeSafetySummary)
    ) {
      throw new InternalServerErrorException(
        'Missing edgeSafetySummary in routing manifest',
      );
    }

    const edgeSafety = m.edgeSafetySummary as Record<string, unknown>;

    const edgeCounterKeys = [
      'totalEdges',
      'verifiedCompatibleEdges',
      'unverifiedEdges',
      'blockedEdges',
      'conflictedEdges',
      'blockedWays',
    ] as const;

    for (const key of edgeCounterKeys) {
      if (
        typeof edgeSafety[key] !== 'number' ||
        !Number.isSafeInteger(edgeSafety[key]) ||
        (edgeSafety[key] as number) < 0
      ) {
        throw new InternalServerErrorException(
          `Invalid edgeSafetySummary.${key} in routing manifest`,
        );
      }
    }

    if (
      typeof edgeSafety.strictSafeEdgesPercent !== 'number' ||
      Number.isNaN(edgeSafety.strictSafeEdgesPercent) ||
      edgeSafety.strictSafeEdgesPercent < 0 ||
      edgeSafety.strictSafeEdgesPercent > 100
    ) {
      throw new InternalServerErrorException(
        'Invalid edgeSafetySummary.strictSafeEdgesPercent in routing manifest',
      );
    }

    return m as unknown as RoutingManifest;
  }
}
