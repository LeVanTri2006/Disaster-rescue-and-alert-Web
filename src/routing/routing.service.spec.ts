import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingStorageService } from './storage/routing-storage.service';
import { RoutingManifest } from './routing.types';

describe('RoutingService', () => {
  let service: RoutingService;
  let storageService: jest.Mocked<RoutingStorageService>;

  function createValidManifest(
    overrides: Record<string, unknown> = {},
  ): RoutingManifest {
    return {
      $schema: 'https://emergency-rescue.vn/schemas/v2/routing-manifest.json',
      manifestVersion: '2.1.0',
      generatedAt: '2026-11-04T12:24:50.392Z',
      graphVersion: 'dn_central_real_v1',
      osmSnapshotTimestamp: '2026-11-03T21:24:23Z',
      importerVersion: 'osm-importer-v2.3-prototype',
      vehicleProfile: 'RESCUE_TRUCK_4X4',
      boundingBoxType: 'PRODUCTION',
      boundingBox: {
        minLon: 108.19,
        minLat: 16.035,
        maxLon: 108.235,
        maxLat: 16.075,
        bufferedMeters: 500,
      },
      targetProductionBoundingBox: {
        minLon: 108.19,
        minLat: 16.035,
        maxLon: 108.235,
        maxLat: 16.075,
        bufferedMeters: 500,
      },
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: 1173443,
        uncompressedSizeBytes: 33002111,
        sha256:
          '9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b',
      },
      activeHazardSnapshotVersion: null,
      hazardSnapshotStatus: 'NOT_INCLUDED',
      hazardAssessmentPolicy: 'HAZARD_DATA_REQUIRED_FOR_LIVE_CONDITIONS',
      isRestrictionStrictRoutingEligible: false,
      restrictionStrictRoutingReadiness: 'NOT_READY_UNRESOLVED_RESTRICTIONS',
      unsupportedRestrictionsSummary: {
        totalCount: 16,
        enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
      },
      canAttemptStrictRouting: false,
      isStrictRoutingEligible: false,
      strictRoutingReadiness: 'NOT_READY_UNRESOLVED_RESTRICTIONS',
      overallStrictRoutingReadiness: 'NOT_READY_UNRESOLVED_RESTRICTIONS',
      edgeSafetySummary: {
        totalEdges: 16651,
        verifiedCompatibleEdges: 0,
        unverifiedEdges: 16651,
        blockedEdges: 0,
        conflictedEdges: 0,
        strictSafeEdgesPercent: 0,
        blockedWays: 1425,
        excludedBlockedWays: 1425,
        retainedBlockedWays: 0,
      },
      ...overrides,
    } as RoutingManifest;
  }

  beforeEach(() => {
    storageService = {
      getCurrentManifest: jest.fn(),
      createGraphDownloadUrl: jest.fn(),
    } as unknown as jest.Mocked<RoutingStorageService>;

    service = new RoutingService(storageService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. should successfully validate manifest and generate download URL', async () => {
    const validManifest = createValidManifest();
    storageService.getCurrentManifest.mockResolvedValue(validManifest);
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz?token=abc',
      expiresIn: 900,
    });

    const result = await service.getCurrentRouting();

    expect(storageService.getCurrentManifest).toHaveBeenCalledTimes(1);
    expect(storageService.createGraphDownloadUrl).toHaveBeenCalledWith(
      'dn_central_real_v1',
      1173443,
    );

    expect(result.downloadAvailable).toBe(true);
    expect(result.download.url).toBe('https://r2.test/download.gz?token=abc');
    expect(result.download.expiresIn).toBe(900);
    expect(result.manifest.graphVersion).toBe('dn_central_real_v1');
    expect(result.strictRoutingReady).toBe(false);
    expect(result.liveHazardReady).toBe(false);
    expect(result.canAttemptStrictRouting).toBe(false);
    expect(result.overallStrictRoutingReadiness).toBe(
      'NOT_READY_NO_VERIFIED_EDGES',
    );
  });

  it('2. should reject manifest with invalid or incompatible version', async () => {
    const badManifest = createValidManifest({ manifestVersion: '2.0.0' });
    storageService.getCurrentManifest.mockResolvedValue(badManifest);

    await expect(service.getCurrentRouting()).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'expected 2.1.0, got 2.0.0',
    );
  });

  it('3. should reject manifest when required fields are missing', async () => {
    // Missing bundle
    const noBundle = createValidManifest();
    delete (noBundle as Record<string, unknown>).bundle;
    storageService.getCurrentManifest.mockResolvedValue(noBundle);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Missing bundle object in routing manifest',
    );

    // Missing graphVersion
    const noGraphVersion = createValidManifest();
    delete (noGraphVersion as Record<string, unknown>).graphVersion;
    storageService.getCurrentManifest.mockResolvedValue(noGraphVersion);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid or missing graphVersion in routing manifest',
    );

    // Missing edgeSafetySummary
    const noEdgeSafety = createValidManifest();
    delete (noEdgeSafety as Record<string, unknown>).edgeSafetySummary;
    storageService.getCurrentManifest.mockResolvedValue(noEdgeSafety);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Missing edgeSafetySummary in routing manifest',
    );

    // Missing unsupportedRestrictionsSummary
    const noRestrictionSummary = createValidManifest();
    delete (noRestrictionSummary as Record<string, unknown>)
      .unsupportedRestrictionsSummary;
    storageService.getCurrentManifest.mockResolvedValue(noRestrictionSummary);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Missing unsupportedRestrictionsSummary in routing manifest',
    );

    // Non-object manifest
    storageService.getCurrentManifest.mockResolvedValue(null);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Routing manifest must be a non-null object',
    );
  });

  it('4. should reject manifest with invalid SHA-256 checksum', async () => {
    const badSha = createValidManifest({
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: 100,
        uncompressedSizeBytes: 200,
        sha256: 'not-a-valid-sha-checksum',
      },
    });
    storageService.getCurrentManifest.mockResolvedValue(badSha);

    await expect(service.getCurrentRouting()).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid or malformed sha256 checksum in routing manifest bundle',
    );

    // Upper-case hex
    const upperCaseSha = createValidManifest({
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: 100,
        uncompressedSizeBytes: 200,
        sha256:
          '9792DCE0ABB089A230BCB79E71B2A8FF83301879D417F4FD399711CE4C3A037B',
      },
    });
    storageService.getCurrentManifest.mockResolvedValue(upperCaseSha);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid or malformed sha256 checksum in routing manifest bundle',
    );
  });

  it('5. should reject manifest with invalid graph size metrics', async () => {
    // Compressed size <= 0
    const zeroSize = createValidManifest({
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: 0,
        uncompressedSizeBytes: 1000,
        sha256:
          '9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b',
      },
    });
    storageService.getCurrentManifest.mockResolvedValue(zeroSize);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid compressedSizeBytes in routing manifest bundle',
    );

    // Uncompressed size < compressed size
    const invertedSize = createValidManifest({
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: 5000,
        uncompressedSizeBytes: 2000,
        sha256:
          '9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b',
      },
    });
    storageService.getCurrentManifest.mockResolvedValue(invertedSize);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid uncompressedSizeBytes in routing manifest bundle',
    );

    // Wrong file name
    const wrongFileName = createValidManifest({
      bundle: {
        fileName: 'BaseRoadGraph.json',
        compressedSizeBytes: 1000,
        uncompressedSizeBytes: 2000,
        sha256:
          '9792dce0abb089a230bcb79e71b2a8ff83301879d417f4fd399711ce4c3a037b',
      },
    });
    storageService.getCurrentManifest.mockResolvedValue(wrongFileName);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Invalid bundle fileName in routing manifest: expected BaseRoadGraph.json.gz',
    );
  });

  it('6. rejects claimed strict permission even when restrictions also forbid it', async () => {
    const manifestWithUnsupportedRestrictions = createValidManifest({
      isRestrictionStrictRoutingEligible: false,
      restrictionStrictRoutingReadiness: 'NOT_READY_UNRESOLVED_RESTRICTIONS',
      unsupportedRestrictionsSummary: {
        totalCount: 5,
        enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
      },
      canAttemptStrictRouting: true,
      overallStrictRoutingReadiness: 'READY',
      edgeSafetySummary: {
        totalEdges: 1000,
        verifiedCompatibleEdges: 1000,
        unverifiedEdges: 0,
        blockedEdges: 0,
        conflictedEdges: 0,
        strictSafeEdgesPercent: 100,
        blockedWays: 0,
      },
    });

    storageService.getCurrentManifest.mockResolvedValue(
      manifestWithUnsupportedRestrictions,
    );
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Production strict routing verification is unavailable',
    );
    expect(storageService.createGraphDownloadUrl).not.toHaveBeenCalled();
  });

  it('7. rejects claimed permission when summary still contains unverified edges', async () => {
    const manifestWithUnverifiedEdges = createValidManifest({
      isRestrictionStrictRoutingEligible: true,
      restrictionStrictRoutingReadiness: 'READY',
      unsupportedRestrictionsSummary: {
        totalCount: 0,
        enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
      },
      canAttemptStrictRouting: true,
      overallStrictRoutingReadiness: 'NOT_READY_HAS_UNVERIFIED_EDGES',
      edgeSafetySummary: {
        totalEdges: 1000,
        verifiedCompatibleEdges: 800,
        unverifiedEdges: 200,
        blockedEdges: 0,
        conflictedEdges: 0,
        strictSafeEdgesPercent: 80,
        blockedWays: 0,
      },
    });

    storageService.getCurrentManifest.mockResolvedValue(
      manifestWithUnverifiedEdges,
    );
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Production strict routing verification is unavailable',
    );
    expect(storageService.createGraphDownloadUrl).not.toHaveBeenCalled();
  });

  it('8. rejects internally consistent READY claims without production authority', async () => {
    const fullyReadyManifest = createValidManifest({
      isRestrictionStrictRoutingEligible: true,
      restrictionStrictRoutingReadiness: 'READY',
      unsupportedRestrictionsSummary: {
        totalCount: 0,
        enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
      },
      canAttemptStrictRouting: true,
      isStrictRoutingEligible: true,
      overallStrictRoutingReadiness: 'READY',
      strictRoutingReadiness: 'READY',
      edgeSafetySummary: {
        totalEdges: 5000,
        verifiedCompatibleEdges: 5000,
        unverifiedEdges: 0,
        blockedEdges: 0,
        conflictedEdges: 0,
        strictSafeEdgesPercent: 100,
        blockedWays: 25,
      },
    });

    storageService.getCurrentManifest.mockResolvedValue(fullyReadyManifest);
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Production strict routing verification is unavailable',
    );
    expect(storageService.createGraphDownloadUrl).not.toHaveBeenCalled();
  });

  it('9. should mark liveHazardReady=false when hazard snapshot is not included', async () => {
    const noHazardManifest = createValidManifest({
      hazardSnapshotStatus: 'NOT_INCLUDED',
      activeHazardSnapshotVersion: null,
    });

    storageService.getCurrentManifest.mockResolvedValue(noHazardManifest);
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    const result = await service.getCurrentRouting();
    expect(result.liveHazardReady).toBe(false);
  });

  it('10. keeps liveHazardReady=false for attached but unauthenticated hazard metadata', async () => {
    const withHazardManifest = createValidManifest({
      hazardSnapshotStatus: 'ATTACHED',
      activeHazardSnapshotVersion: 'hz_danang_20261104_120000',
    });

    storageService.getCurrentManifest.mockResolvedValue(withHazardManifest);
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    const result = await service.getCurrentRouting();
    expect(result.liveHazardReady).toBe(false);
    expect(result.manifest.activeHazardSnapshotVersion).toBe(
      'hz_danang_20261104_120000',
    );
  });

  it('11. should propagate NotFoundException when storage cannot find the manifest', async () => {
    storageService.getCurrentManifest.mockRejectedValue(
      new NotFoundException('Published routing manifest was not found'),
    );

    await expect(service.getCurrentRouting()).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Published routing manifest was not found',
    );
    expect(storageService.createGraphDownloadUrl).not.toHaveBeenCalled();
  });

  it('12. should propagate storage errors when createGraphDownloadUrl fails', async () => {
    storageService.getCurrentManifest.mockResolvedValue(createValidManifest());
    storageService.createGraphDownloadUrl.mockRejectedValue(
      new ConflictException(
        'Stored routing graph size does not match manifest',
      ),
    );

    await expect(service.getCurrentRouting()).rejects.toThrow(
      ConflictException,
    );
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'Stored routing graph size does not match manifest',
    );
  });

  it('13. should reject inconsistent hazard snapshot states', async () => {
    // ATTACHED with empty version
    const attachedEmpty = createValidManifest({
      hazardSnapshotStatus: 'ATTACHED',
      activeHazardSnapshotVersion: '   ',
    });
    storageService.getCurrentManifest.mockResolvedValue(attachedEmpty);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'activeHazardSnapshotVersion must be specified when hazardSnapshotStatus is ATTACHED',
    );

    // NOT_INCLUDED with non-null version
    const notIncludedWithVersion = createValidManifest({
      hazardSnapshotStatus: 'NOT_INCLUDED',
      activeHazardSnapshotVersion: 'stale_version',
    });
    storageService.getCurrentManifest.mockResolvedValue(notIncludedWithVersion);
    await expect(service.getCurrentRouting()).rejects.toThrow(
      'activeHazardSnapshotVersion must be null when hazardSnapshotStatus is NOT_INCLUDED',
    );
  });

  it('14. getRoutingStatus alias returns exact same result as getCurrentRouting', async () => {
    storageService.getCurrentManifest.mockResolvedValue(createValidManifest());
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });

    const res1 = await service.getCurrentRouting();
    const res2 = await service.getRoutingStatus();

    expect(res1).toEqual(res2);
  });

  it('does not mutate a frozen stored manifest or share nested response metadata', async () => {
    const stored = createValidManifest({
      isRestrictionStrictRoutingEligible: true,
      restrictionStrictRoutingReadiness: 'READY',
    });
    const before = structuredClone(stored);
    Object.freeze(stored.bundle);
    Object.freeze(stored.edgeSafetySummary);
    Object.freeze(stored);
    storageService.getCurrentManifest.mockResolvedValue(stored);
    storageService.createGraphDownloadUrl.mockResolvedValue({
      url: 'https://r2.test/download.gz',
      expiresIn: 900,
    });
    const result = await service.getCurrentRouting();
    expect(stored).toEqual(before);
    expect(result.manifest).not.toBe(stored);
    expect(result.manifest.bundle).not.toBe(stored.bundle);
    expect(result.manifest.edgeSafetySummary).not.toBe(
      stored.edgeSafetySummary,
    );
    expect(result.manifest.isRestrictionStrictRoutingEligible).toBe(false);
    expect(result.manifest.restrictionStrictRoutingReadiness).toBe(
      'NOT_READY_NO_VERIFIED_EDGES',
    );
    result.manifest.bundle.sha256 = '0'.repeat(64);
    result.manifest.edgeSafetySummary.unverifiedEdges = 0;
    expect(stored).toEqual(before);
    expect((await service.getRoutingStatus()).manifest.bundle.sha256).toBe(
      before.bundle.sha256,
    );
  });
});
