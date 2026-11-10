import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { RoutingManifest, RoutingStatusResponse } from './routing.types';

describe('RoutingController', () => {
  let controller: RoutingController;
  let service: jest.Mocked<RoutingService>;

  const mockResponse: RoutingStatusResponse = {
    manifest: {
      $schema: 'https://emergency-rescue.vn/schemas/v2/routing-manifest.json',
      manifestVersion: '2.1.0',
      generatedAt: '2026-11-04T12:24:50.392Z',
      graphVersion: 'dn_central_real_v1',
      osmSnapshotTimestamp: '2026-11-03T21:24:23Z',
      importerVersion: 'osm-importer-v2.3-prototype',
      vehicleProfile: 'RESCUE_TRUCK_4X4',
      boundingBoxType: 'PRODUCTION',
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
    } as RoutingManifest,
    download: {
      url: 'https://r2.test/routing/danang/versions/dn_central_real_v1/BaseRoadGraph.json.gz?X-Amz-Expires=900',
      expiresIn: 900,
    },
    downloadAvailable: true,
    strictRoutingReady: false,
    liveHazardReady: false,
    canAttemptStrictRouting: false,
    overallStrictRoutingReadiness: 'NOT_READY_UNRESOLVED_RESTRICTIONS',
  };

  beforeEach(async () => {
    const mockRoutingService = {
      getCurrentRouting: jest.fn(),
      getRoutingStatus: jest.fn(),
      validateManifest: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoutingController],
      providers: [
        {
          provide: RoutingService,
          useValue: mockRoutingService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = moduleRef.get<RoutingController>(RoutingController);
    service = moduleRef.get<RoutingService>(
      RoutingService,
    ) as jest.Mocked<RoutingService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should call RoutingService.getCurrentRouting() when GET /routing/current is called', async () => {
    service.getCurrentRouting.mockResolvedValue(mockResponse);

    await controller.getCurrentRouting();

    expect(service.getCurrentRouting).toHaveBeenCalledTimes(1);
    expect(service.getCurrentRouting).toHaveBeenCalledWith();
  });

  it('2. should return the exact response provided by RoutingService', async () => {
    service.getCurrentRouting.mockResolvedValue(mockResponse);

    const result = await controller.getCurrentRouting();

    expect(result).toEqual(mockResponse);
    expect(result.manifest.graphVersion).toBe('dn_central_real_v1');
    expect(result.download.url).toBe(
      'https://r2.test/routing/danang/versions/dn_central_real_v1/BaseRoadGraph.json.gz?X-Amz-Expires=900',
    );
    expect(result.download.expiresIn).toBe(900);
  });

  it('3. should not alter or recalculate routing status flags from the service', async () => {
    const customResponse: RoutingStatusResponse = {
      ...mockResponse,
      downloadAvailable: true,
      strictRoutingReady: true,
      liveHazardReady: true,
      canAttemptStrictRouting: true,
      overallStrictRoutingReadiness: 'READY',
    };
    service.getCurrentRouting.mockResolvedValue(customResponse);

    const result = await controller.getCurrentRouting();

    expect(result.downloadAvailable).toBe(true);
    expect(result.strictRoutingReady).toBe(true);
    expect(result.liveHazardReady).toBe(true);
    expect(result.canAttemptStrictRouting).toBe(true);
    expect(result.overallStrictRoutingReadiness).toBe('READY');
  });

  it('4. should propagate exceptions from RoutingService without swallowing or re-wrapping', async () => {
    // 4.1 NotFoundException (e.g. manifest not published)
    service.getCurrentRouting.mockRejectedValue(
      new NotFoundException('Published routing manifest was not found'),
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      NotFoundException,
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      'Published routing manifest was not found',
    );

    // 4.2 InternalServerErrorException (e.g. invalid manifest schema or version)
    service.getCurrentRouting.mockRejectedValue(
      new InternalServerErrorException(
        'Invalid or unsupported routing manifest version: expected 2.1.0',
      ),
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      'Invalid or unsupported routing manifest version: expected 2.1.0',
    );

    // 4.3 ServiceUnavailableException (e.g. R2 credentials missing)
    service.getCurrentRouting.mockRejectedValue(
      new ServiceUnavailableException(
        'Routing object storage is not configured',
      ),
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      ServiceUnavailableException,
    );

    // 4.4 ConflictException (e.g. graph size mismatch)
    service.getCurrentRouting.mockRejectedValue(
      new ConflictException('Stored routing graph size does not match manifest'),
    );
    await expect(controller.getCurrentRouting()).rejects.toThrow(
      ConflictException,
    );
  });

  it('5. should have JwtAuthGuard and RolesGuard attached to controller metadata', () => {
    const guards = Reflect.getMetadata('__guards__', RoutingController);

    expect(guards).toBeDefined();
    expect(guards).toBeInstanceOf(Array);
    expect(guards).toHaveLength(2);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('6. should specify required roles containing RESCUER, ADMIN, and MODERATOR, and explicitly excluding USER', () => {
    const reflector = new Reflector();

    // Check class-level metadata
    const classRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      RoutingController,
    );
    expect(classRoles).toBeDefined();
    expect(classRoles).toContain(UserRole.RESCUER);
    expect(classRoles).toContain(UserRole.ADMIN);
    expect(classRoles).toContain(UserRole.MODERATOR);
    expect(classRoles).not.toContain(UserRole.USER);
    expect(classRoles).toHaveLength(3);

    // Check method-level metadata on getCurrentRouting
    const methodRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      controller.getCurrentRouting,
    );
    expect(methodRoles).toBeDefined();
    expect(methodRoles).toContain(UserRole.RESCUER);
    expect(methodRoles).toContain(UserRole.ADMIN);
    expect(methodRoles).toContain(UserRole.MODERATOR);
    expect(methodRoles).not.toContain(UserRole.USER);
    expect(methodRoles).toHaveLength(3);

    // Check combined resolution via getAllAndOverride
    const effectiveRoles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      controller.getCurrentRouting,
      RoutingController,
    ]);
    expect(effectiveRoles).toEqual([
      UserRole.RESCUER,
      UserRole.ADMIN,
      UserRole.MODERATOR,
    ]);
  });
});
