import { Test } from '@nestjs/testing';
import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { gzipSync, gunzipSync } from 'node:zlib';
import { RoutingController } from '../../../src/routing/routing.controller';
import { RoutingService } from '../../../src/routing/routing.service';
import { RoutingStorageService } from '../../../src/routing/storage/routing-storage.service';
import {
  RoutingManifest,
  RoutingStatusResponse,
} from '../../../src/routing/routing.types';
import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { UsersService } from '../../../src/users/users.service';
import { UserRole } from '../../../src/users/enums/user-role.enum';
import { UserStatus } from '../../../src/users/enums/user-status.enum';
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter';
import type { BaseRoadGraph } from '../../../tools/osm-importer/src/types';

export const digest = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export function fixtureGraph(now: number): BaseRoadGraph {
  return {
    contractVersion: '2.1.0',
    graphVersion: 'http_demo_fixture_v1',
    vehicleProfile: 'RESCUE_TRUCK_4X4',
    boundingBoxType: 'FIXTURE',
    generatedAt: new Date(now).toISOString(),
    osmSnapshotTimestamp: new Date(now).toISOString(),
    isRestrictionStrictRoutingEligible: true,
    restrictionStrictRoutingReadiness: 'READY',
    canAttemptStrictRouting: false,
    isStrictRoutingEligible: false,
    overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
    strictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
    edgeSafetySummary: {
      totalEdges: 1,
      verifiedCompatibleEdges: 0,
      unverifiedEdges: 1,
      blockedEdges: 0,
      conflictedEdges: 0,
      strictSafeEdgesPercent: 0,
      blockedWays: 0,
    },
    nodes: [
      { id: 'fixture_a', osmNodeId: null, lat: 0, lon: 0, isSynthetic: true },
      {
        id: 'fixture_b',
        osmNodeId: null,
        lat: 0,
        lon: 0.001,
        isSynthetic: true,
      },
    ],
    edges: [
      {
        id: 'fixture_edge',
        osmWayId: 1,
        fromNodeId: 'fixture_a',
        toNodeId: 'fixture_b',
        isWayForward: true,
        lengthMeters: 111,
        geometry: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 0.001 },
        ],
        wayFlowPolicy: 'FORWARD',
        compatibilityStatus: 'UNVERIFIED',
        isEligibleForStrictRouting: false,
        metadata: {
          name: 'SIMULATED UNVERIFIED DEMO',
          highwayType: 'service',
          surface: 'unknown',
          smoothness: 'unknown',
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
          bridge: false,
          tunnel: false,
          layer: 0,
          rawTags: {},
        },
      },
    ],
    turnRestrictions: [],
  };
}

export interface FixtureUser {
  id: string;
  role?: UserRole | string;
  status: UserStatus;
  rescueProfile?: { verificationStatus: string };
}

type DownloadFault =
  | 'NONE'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'CONTENT_TYPE'
  | 'ABORT';

/** Test adapter, not the R2 implementation. No environment credentials or filesystem writes. */
export class FixtureStorage {
  manifest: unknown;
  bytes: Buffer;
  now = Date.now();
  origin = '';
  available = true;
  manifestMissing = false;
  artifactMissing = false;
  fault: DownloadFault = 'NONE';
  reads = 0;
  readonly urlSecret = randomBytes(32);

  constructor() {
    this.reset();
  }

  reset(): void {
    this.now = Date.now();
    const graph = fixtureGraph(this.now);
    const raw = Buffer.from(JSON.stringify(graph));
    this.bytes = gzipSync(raw);
    this.manifest = {
      manifestVersion: '2.1.0',
      generatedAt: new Date(this.now).toISOString(),
      graphVersion: graph.graphVersion,
      osmSnapshotTimestamp: new Date(this.now).toISOString(),
      importerVersion: 'P5-I01-IN_MEMORY_FIXTURE',
      vehicleProfile: graph.vehicleProfile,
      boundingBoxType: 'FIXTURE',
      bundle: {
        fileName: 'BaseRoadGraph.json.gz',
        compressedSizeBytes: this.bytes.length,
        uncompressedSizeBytes: raw.length,
        sha256: digest(this.bytes),
      },
      activeHazardSnapshotVersion: null,
      hazardSnapshotStatus: 'NOT_INCLUDED',
      hazardAssessmentPolicy: 'HAZARD_DATA_REQUIRED_FOR_LIVE_CONDITIONS',
      isRestrictionStrictRoutingEligible: true,
      restrictionStrictRoutingReadiness: 'READY',
      unsupportedRestrictionsSummary: {
        totalCount: 0,
        enforcementPolicy: 'FAIL_CLOSED_IN_STRICT_MODE',
      },
      canAttemptStrictRouting: false,
      isStrictRoutingEligible: false,
      overallStrictRoutingReadiness: graph.overallStrictRoutingReadiness,
      strictRoutingReadiness: graph.strictRoutingReadiness,
      edgeSafetySummary: { ...graph.edgeSafetySummary },
    } satisfies RoutingManifest;
    this.available = true;
    this.manifestMissing = false;
    this.artifactMissing = false;
    this.fault = 'NONE';
    this.reads = 0;
  }

  async getCurrentManifest(): Promise<unknown> {
    this.reads++;
    if (!this.available)
      throw new ServiceUnavailableException('Fixture storage unavailable');
    if (this.manifestMissing)
      throw new NotFoundException('Fixture manifest missing');
    return structuredClone(this.manifest);
  }

  async createGraphDownloadUrl(graphVersion: string, size: number) {
    if (!this.available)
      throw new ServiceUnavailableException('Fixture storage unavailable');
    if (this.artifactMissing)
      throw new NotFoundException('Fixture artifact missing');
    if (size !== this.bytes.length)
      throw new ConflictException(
        'Stored routing graph size does not match manifest',
      );
    const path = `/download/${encodeURIComponent(graphVersion)}/BaseRoadGraph.json.gz`;
    const expires = String(this.now + 900_000);
    const signature = this.sign(path, expires);
    return {
      url: `${this.origin}${path}?expires=${expires}&signature=${signature}`,
      expiresIn: 900,
    };
  }

  sign(path: string, expires: string): string {
    return createHmac('sha256', this.urlSecret)
      .update(`${path}\n${expires}`)
      .digest('hex');
  }

  server(): Server {
    return createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (
        !/^\/download\/[A-Za-z0-9_-]+\/BaseRoadGraph\.json\.gz$/.test(
          url.pathname,
        )
      ) {
        res.writeHead(404).end();
        return;
      }
      const expires = url.searchParams.get('expires') ?? '';
      const signature = url.searchParams.get('signature') ?? '';
      const expected = this.sign(url.pathname, expires);
      if (
        !/^\d+$/.test(expires) ||
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex'),
        )
      ) {
        res.writeHead(403).end('INVALID_FIXTURE_SIGNATURE');
        return;
      }
      if (Number(expires) <= this.now) {
        res.writeHead(403).end('EXPIRED_FIXTURE_URL');
        return;
      }
      if (this.artifactMissing || this.fault === 'NOT_FOUND') {
        res.writeHead(404).end();
        return;
      }
      if (!this.available || this.fault === 'UNAVAILABLE') {
        res.writeHead(503).end();
        return;
      }
      if (this.fault === 'SERVER_ERROR') {
        res.writeHead(500).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type':
          this.fault === 'CONTENT_TYPE' ? 'text/html' : 'application/gzip',
        'Content-Length': this.bytes.length,
        'Content-Disposition': 'attachment; filename="BaseRoadGraph.json.gz"',
      });
      if (this.fault === 'ABORT') {
        res.flushHeaders();
        res.write(this.bytes.subarray(0, Math.floor(this.bytes.length / 2)));
        setImmediate(() => res.destroy());
        return;
      }
      res.end(this.bytes);
    });
  }
}

export interface HttpHarness {
  app: INestApplication;
  origin: string;
  storage: FixtureStorage;
  users: Map<unknown, FixtureUser>;
  token: (claims?: Record<string, unknown>, wrongSecret?: boolean) => string;
  current: (token?: string) => Promise<Response>;
  close: () => Promise<void>;
}

export async function startHarness(): Promise<HttpHarness> {
  const storage = new FixtureStorage();
  const downloadServer = storage.server();
  let app: INestApplication | undefined;
  const savedSecret = process.env.JWT_ACCESS_SECRET;
  const secret = randomBytes(48).toString('hex');
  process.env.JWT_ACCESS_SECRET = secret;
  const users = new Map<unknown, FixtureUser>([
    [
      'rescuer',
      {
        id: 'rescuer',
        role: UserRole.RESCUER,
        status: UserStatus.ACTIVE,
        rescueProfile: { verificationStatus: 'APPROVED' },
      },
    ],
    ['admin', { id: 'admin', role: UserRole.ADMIN, status: UserStatus.ACTIVE }],
    [
      'moderator',
      { id: 'moderator', role: UserRole.MODERATOR, status: UserStatus.ACTIVE },
    ],
    ['user', { id: 'user', role: UserRole.USER, status: UserStatus.ACTIVE }],
    [
      'pending-rescuer',
      {
        id: 'pending-rescuer',
        role: UserRole.RESCUER,
        status: UserStatus.ACTIVE,
        rescueProfile: { verificationStatus: 'PENDING' },
      },
    ],
    ['no-role', { id: 'no-role', status: UserStatus.ACTIVE }],
    [
      'banned',
      { id: 'banned', role: UserRole.ADMIN, status: UserStatus.BANNED },
    ],
    [
      'inactive',
      { id: 'inactive', role: UserRole.ADMIN, status: UserStatus.INACTIVE },
    ],
  ]);
  const restoreSecret = () => {
    if (savedSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = savedSecret;
  };
  try {
    await new Promise<void>((resolve, reject) => {
      downloadServer.once('error', reject);
      downloadServer.listen(0, '127.0.0.1', resolve);
    });
    storage.origin = `http://127.0.0.1:${(downloadServer.address() as AddressInfo).port}`;
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [RoutingController],
      providers: [
        RoutingService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        {
          provide: UsersService,
          useValue: { findById: async (id: unknown) => users.get(id) ?? null },
        },
        { provide: RoutingStorageService, useValue: storage },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    const origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const jwt = new JwtService();
    return {
      app,
      storage,
      users,
      origin,
      token: (claims = { sub: 'rescuer' }, wrongSecret = false) =>
        jwt.sign(claims, {
          secret: wrongSecret ? `${secret}-wrong` : secret,
          algorithm: 'HS256',
          ...(claims.exp === undefined ? { expiresIn: 60 } : {}),
        }),
      current: (token) =>
        fetch(`${origin}/routing/current`, {
          headers:
            token === undefined ? {} : { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }),
      close: async () => {
        try {
          await app?.close();
        } finally {
          downloadServer.closeAllConnections();
          await new Promise<void>((resolve) =>
            downloadServer.close(() => resolve()),
          );
          restoreSecret();
        }
      },
    };
  } catch (error) {
    await app?.close();
    downloadServer.closeAllConnections();
    await new Promise<void>((resolve) => downloadServer.close(() => resolve()));
    restoreSecret();
    throw error;
  }
}

export function manifestOf(h: HttpHarness): RoutingManifest {
  // Test controls a valid typed fixture; arbitrary malformed input is assigned separately.
  return h.storage.manifest as RoutingManifest;
}

export async function statusOf(h: HttpHarness): Promise<RoutingStatusResponse> {
  const response = await h.current(h.token());
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body: RoutingStatusResponse = await response.json();
  // Assert the complete API decision, not the demo consumer's independent hardcoded lock.
  expect(body).toMatchObject({
    strictRoutingReady: false,
    liveHazardReady: false,
    canAttemptStrictRouting: false,
    overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
    manifest: {
      canAttemptStrictRouting: false,
      isStrictRoutingEligible: false,
      isRestrictionStrictRoutingEligible: false,
      overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
      strictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
      restrictionStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
    },
  });
  return body;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Demonstration consumer assertions only. Not an Android implementation or production verifier. */
export async function inspectDownload(
  status: RoutingStatusResponse,
  now: number,
  allowedOrigin: string,
) {
  const m = status.manifest;
  if (m.manifestVersion !== '2.1.0') throw new Error('MANIFEST_VERSION');
  if (
    !Number.isFinite(Date.parse(m.generatedAt)) ||
    now - Date.parse(m.generatedAt) > 3_600_000 ||
    Date.parse(m.generatedAt) > now
  )
    throw new Error('STALE_MANIFEST');
  const url = new URL(status.download.url);
  if (url.origin !== allowedOrigin) throw new Error('DOWNLOAD_ORIGIN');
  let response: Response;
  let bytes: Buffer;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
    if (response.headers.get('content-type') !== 'application/gzip')
      throw new Error('DOWNLOAD_CONTENT_TYPE');
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && /^DOWNLOAD_/.test(error.message)) throw error;
    throw new Error('DOWNLOAD_TRANSPORT');
  }
  if (bytes.length !== m.bundle.compressedSizeBytes)
    throw new Error('COMPRESSED_LENGTH');
  if (digest(bytes) !== m.bundle.sha256) throw new Error('SHA256_MISMATCH');
  let raw: Buffer;
  try {
    raw = gunzipSync(bytes, { maxOutputLength: 1_000_000 });
  } catch {
    throw new Error('INVALID_GZIP');
  }
  if (raw.length !== m.bundle.uncompressedSizeBytes)
    throw new Error('UNCOMPRESSED_LENGTH');
  let graph: unknown;
  try {
    graph = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Error('GRAPH_JSON');
  }
  if (!record(graph)) throw new Error('GRAPH_SCHEMA');
  if (graph.contractVersion !== '2.1.0')
    throw new Error('GRAPH_CONTRACT_VERSION');
  if (graph.graphVersion !== m.graphVersion)
    throw new Error('GRAPH_VERSION_MISMATCH');
  if (graph.vehicleProfile !== m.vehicleProfile)
    throw new Error('GRAPH_PROFILE_MISMATCH');
  if (!Array.isArray(graph.edges) || graph.edges.length === 0)
    throw new Error('GRAPH_SCHEMA');
  if (
    graph.edges.some(
      (edge: unknown) =>
        !record(edge) ||
        edge.compatibilityStatus !== 'UNVERIFIED' ||
        edge.isEligibleForStrictRouting !== false,
    )
  )
    throw new Error('EDGE_QUALIFICATION');
  // No approval path exists in this test consumer, even if an upstream flag says READY.
  return {
    bytes,
    graph,
    qualificationStatus: 'UNVERIFIED' as const,
    canAttemptStrictRouting: false as const,
  };
}
