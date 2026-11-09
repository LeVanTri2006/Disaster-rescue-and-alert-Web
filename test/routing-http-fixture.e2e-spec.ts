import type { RoutingManifest } from '../src/routing/routing.types';
import {
  HttpHarness,
  inspectDownload,
  manifestOf,
  startHarness,
  statusOf,
} from './fixtures/routing/http-harness';

describe('P5-I01 routing manifest through Nest HTTP', () => {
  let h: HttpHarness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(() => h.storage.reset());

  async function expectUnverifiedClaimRejected(): Promise<void> {
    const logged = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const response = await h.current(h.token());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: {
          statusCode: 500,
          message:
            'Production strict routing verification is unavailable; manifest readiness claims cannot be accepted',
        },
      });
    } finally {
      logged.mockRestore();
    }
  }

  it('returns the actual 2.1.0 response envelope with download and closed readiness', async () => {
    const status = await statusOf(h);
    expect(Object.keys(status).sort()).toEqual(
      [
        'manifest',
        'download',
        'downloadAvailable',
        'strictRoutingReady',
        'liveHazardReady',
        'canAttemptStrictRouting',
        'overallStrictRoutingReadiness',
      ].sort(),
    );
    expect(status).toMatchObject({
      downloadAvailable: true,
      strictRoutingReady: false,
      liveHazardReady: false,
      canAttemptStrictRouting: false,
      overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
      manifest: {
        manifestVersion: '2.1.0',
        graphVersion: 'http_demo_fixture_v1',
        boundingBoxType: 'FIXTURE',
        activeHazardSnapshotVersion: null,
        hazardSnapshotStatus: 'NOT_INCLUDED',
        edgeSafetySummary: {
          totalEdges: 1,
          unverifiedEdges: 1,
          verifiedCompatibleEdges: 0,
        },
        bundle: {
          fileName: 'BaseRoadGraph.json.gz',
          compressedSizeBytes: h.storage.bytes.length,
        },
      },
      download: { expiresIn: 900 },
    });
    expect(status.manifest.bundle.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(new URL(status.download.url).origin).toBe(h.storage.origin);
    // Current manifest contract has no top-level qualificationStatus field.
    expect(status.manifest).not.toHaveProperty('qualificationStatus');
    const downloaded = await inspectDownload(
      status,
      h.storage.now,
      h.storage.origin,
    );
    expect(downloaded.qualificationStatus).toBe('UNVERIFIED');
    expect(downloaded.canAttemptStrictRouting).toBe(false);
  });

  const invalid: [string, (m: RoutingManifest) => unknown, string][] = [
    ['null', () => null, 'non-null object'],
    ['array', () => [], 'non-null object'],
    ['malformed response string', () => '{broken-json', 'non-null object'],
    ['missing fields', () => ({ manifestVersion: '2.1.0' }), 'graphVersion'],
    [
      'unsupported version',
      (m) => ({ ...m, manifestVersion: '3.0.0' }),
      'unsupported routing manifest version',
    ],
    [
      'invalid graph identity',
      (m) => ({ ...m, graphVersion: '../escape' }),
      'graphVersion',
    ],
    ['missing bundle', (m) => ({ ...m, bundle: undefined }), 'bundle'],
    [
      'wrong artifact filename',
      (m) => ({ ...m, bundle: { ...m.bundle, fileName: 'Other.gz' } }),
      'fileName',
    ],
    [
      'raw JSON bundle is unsupported',
      (m) => ({
        ...m,
        bundle: { ...m.bundle, fileName: 'BaseRoadGraph.json' },
      }),
      'fileName',
    ],
    [
      'zero compressed length',
      (m) => ({ ...m, bundle: { ...m.bundle, compressedSizeBytes: 0 } }),
      'compressedSizeBytes',
    ],
    [
      'fractional compressed length',
      (m) => ({ ...m, bundle: { ...m.bundle, compressedSizeBytes: 1.5 } }),
      'compressedSizeBytes',
    ],
    [
      'invalid digest',
      (m) => ({ ...m, bundle: { ...m.bundle, sha256: 'invalid' } }),
      'sha256',
    ],
    [
      'invalid timestamp',
      (m) => ({ ...m, generatedAt: 'not-a-time' }),
      'generatedAt',
    ],
    [
      'missing qualification summary',
      (m) => ({ ...m, edgeSafetySummary: undefined }),
      'edgeSafetySummary',
    ],
    [
      'missing strict gate',
      (m) => ({ ...m, canAttemptStrictRouting: undefined }),
      'canAttemptStrictRouting',
    ],
    [
      'hazard UNKNOWN',
      (m) => ({ ...m, hazardSnapshotStatus: 'UNKNOWN' }),
      'hazardSnapshotStatus',
    ],
    [
      'attached hazard without identity',
      (m) => ({
        ...m,
        hazardSnapshotStatus: 'ATTACHED',
        activeHazardSnapshotVersion: null,
      }),
      'activeHazardSnapshotVersion',
    ],
  ];
  it.each(invalid)(
    'rejects %s over HTTP with production error envelope',
    async (_name, change, reason) => {
      h.storage.manifest = change(manifestOf(h));
      // Production global filter logs 500s. Capture expected diagnostics without changing its behavior.
      const logged = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const response = await h.current(h.token());
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body).toEqual({
          success: false,
          error: { statusCode: 500, message: expect.stringContaining(reason) },
        });
        expect(body).not.toHaveProperty('download');
        expect(body).not.toHaveProperty('strictRoutingReady');
        expect(logged).toHaveBeenCalled();
      } finally {
        logged.mockRestore();
      }
    },
  );

  it.each([
    ['missing manifest', 404, 'Fixture manifest missing'],
    ['missing artifact', 404, 'Fixture artifact missing'],
    ['storage unavailable', 503, 'Fixture storage unavailable'],
    [
      'HEAD-equivalent size mismatch',
      409,
      'Stored routing graph size does not match manifest',
    ],
  ] as const)(
    'propagates %s from external adapter boundary',
    async (name, statusCode, message) => {
      if (name === 'missing manifest') h.storage.manifestMissing = true;
      if (name === 'missing artifact') h.storage.artifactMissing = true;
      if (name === 'storage unavailable') h.storage.available = false;
      if (name === 'HEAD-equivalent size mismatch')
        manifestOf(h).bundle.compressedSizeBytes++;
      const response = await h.current(h.token());
      expect(response.status).toBe(statusCode);
      expect(await response.json()).toEqual({
        success: false,
        error: { statusCode, message },
      });
    },
  );

  it('reproduces absent freshness enforcement: stale manifest returns 200 but demo consumer rejects', async () => {
    manifestOf(h).generatedAt = '2000-01-01T00:00:00.000Z';
    const status = await statusOf(h);
    expect(status.strictRoutingReady).toBe(false);
    expect(status.canAttemptStrictRouting).toBe(false);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('STALE_MANIFEST');
  });

  it('does not confuse attached hazard metadata with qualification approval', async () => {
    Object.assign(manifestOf(h), {
      hazardSnapshotStatus: 'ATTACHED',
      activeHazardSnapshotVersion: 'fixture_hazard',
    });
    const status = await statusOf(h);
    expect(status.liveHazardReady).toBe(false);
    expect(status.strictRoutingReady).toBe(false);
    expect(status.canAttemptStrictRouting).toBe(false);
  });

  it('blocks I01-B1a: does not expose claimed permission with UNVERIFIED summary', async () => {
    const safe = await statusOf(h);
    manifestOf(h).canAttemptStrictRouting = true;
    expect(manifestOf(h).edgeSafetySummary.unverifiedEdges).toBe(1);
    await expectUnverifiedClaimRejected();
    const actual = await inspectDownload(safe, h.storage.now, h.storage.origin);
    expect(actual.canAttemptStrictRouting).toBe(false);
  });

  it('blocks I01-B1b: rejects READY claims despite hash-matched GZIP containing UNVERIFIED edges', async () => {
    const safe = await statusOf(h);
    const m = manifestOf(h);
    Object.assign(m, {
      canAttemptStrictRouting: true,
      isStrictRoutingEligible: true,
      overallStrictRoutingReadiness: 'READY',
      strictRoutingReadiness: 'READY',
    });
    Object.assign(m.edgeSafetySummary, {
      verifiedCompatibleEdges: 1,
      unverifiedEdges: 0,
      strictSafeEdgesPercent: 100,
    });
    // The graph bytes and their digest remain unchanged. No self-asserted summary can grant authority.
    expect(m.bundle.sha256).toBe(safe.manifest.bundle.sha256);
    await expectUnverifiedClaimRejected();
    const actual = await inspectDownload(safe, h.storage.now, h.storage.origin);
    expect(actual.graph).toMatchObject({
      edges: [
        {
          compatibilityStatus: 'UNVERIFIED',
          isEligibleForStrictRouting: false,
        },
      ],
    });
    expect(actual.qualificationStatus).toBe('UNVERIFIED');
    expect(actual.canAttemptStrictRouting).toBe(false);
  });

  const claims: [string, (m: RoutingManifest) => unknown][] = [
    [
      'READY with zero verified edges',
      (m) => ({ ...m, overallStrictRoutingReadiness: 'READY' }),
    ],
    [
      'true legacy eligibility alias',
      (m) => ({ ...m, isStrictRoutingEligible: true }),
    ],
    [
      'READY legacy readiness alias',
      (m) => ({ ...m, strictRoutingReadiness: 'READY' }),
    ],
    [
      'malformed optional eligibility alias',
      (m) => ({ ...m, isStrictRoutingEligible: 'true' }),
    ],
    [
      'malformed optional readiness alias',
      (m) => ({ ...m, strictRoutingReadiness: 'VERIFIED_COMPATIBLE' }),
    ],
    [
      'claimed verified count alone',
      (m) => ({
        ...m,
        edgeSafetySummary: {
          ...m.edgeSafetySummary,
          verifiedCompatibleEdges: 1,
        },
      }),
    ],
    [
      'claimed safe percent alone',
      (m) => ({
        ...m,
        edgeSafetySummary: {
          ...m.edgeSafetySummary,
          strictSafeEdgesPercent: 100,
        },
      }),
    ],
    [
      'multiple contradictory readiness fields',
      (m) => ({
        ...m,
        canAttemptStrictRouting: false,
        isStrictRoutingEligible: true,
        overallStrictRoutingReadiness: 'READY',
        strictRoutingReadiness: 'NOT_READY_HAS_UNVERIFIED_EDGES',
      }),
    ],
  ];
  it.each(claims)(
    'rejects unverified production claim: %s',
    async (_name, change) => {
      h.storage.manifest = change(manifestOf(h));
      await expectUnverifiedClaimRejected();
    },
  );

  it('omits caller-supplied proof/provider/approval claims and stays locked without providers', async () => {
    Object.assign(manifestOf(h), {
      strictRoutingReady: true,
      liveHazardReady: true,
      isProductionApproved: true,
      qualificationStatus: 'VERIFIED_COMPATIBLE',
      provider: { state: 'PRODUCTION_VERIFIED' },
      receipt: { trustStatus: 'VERIFIED_TEST_ONLY', purpose: 'TEST_ONLY' },
    });
    for (const object of [
      manifestOf(h).bundle,
      manifestOf(h).edgeSafetySummary,
      manifestOf(h).unsupportedRestrictionsSummary,
    ]) {
      Object.assign(object, {
        strictRoutingReady: true,
        isProductionApproved: true,
      });
    }
    const status = await statusOf(h);
    for (const field of [
      'strictRoutingReady',
      'liveHazardReady',
      'isProductionApproved',
      'qualificationStatus',
      'provider',
      'receipt',
    ]) {
      expect(status.manifest).not.toHaveProperty(field);
    }
    for (const object of [
      status.manifest.bundle,
      status.manifest.edgeSafetySummary,
      status.manifest.unsupportedRestrictionsSummary,
    ]) {
      expect(object).not.toHaveProperty('strictRoutingReady');
      expect(object).not.toHaveProperty('isProductionApproved');
    }
    expect(status.downloadAvailable).toBe(true);
    await inspectDownload(status, h.storage.now, h.storage.origin);
  });

  it('keeps repeated requests locked and does not mutate stored metadata or response aliases', async () => {
    const before = structuredClone(h.storage.manifest);
    for (let i = 0; i < 3; i++) {
      const status = await statusOf(h);
      expect(status.downloadAvailable).toBe(true);
      expect(h.storage.manifest).toEqual(before);
    }
    // Store still declares restriction readiness; only the response view is conservatively locked.
    expect(manifestOf(h).isRestrictionStrictRoutingEligible).toBe(true);
    expect(manifestOf(h).restrictionStrictRoutingReadiness).toBe('READY');
  });

  it('does not grant readiness for future metadata with a parseable timestamp', async () => {
    manifestOf(h).generatedAt = '2099-01-01T00:00:00.000Z';
    const status = await statusOf(h);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('STALE_MANIFEST');
  });

  it('fills omitted legacy readiness aliases with the same locked decision', async () => {
    delete manifestOf(h).isStrictRoutingEligible;
    delete manifestOf(h).strictRoutingReadiness;
    const status = await statusOf(h);
    expect(status.manifest.manifestVersion).toBe('2.1.0');
    expect(manifestOf(h)).not.toHaveProperty('isStrictRoutingEligible');
    expect(manifestOf(h)).not.toHaveProperty('strictRoutingReadiness');
  });
});
