import { gzipSync } from 'node:zlib';
import {
  HttpHarness,
  digest,
  fixtureGraph,
  inspectDownload,
  manifestOf,
  startHarness,
  statusOf,
} from './fixtures/routing/http-harness';

describe('P5-I01 actual loopback graph download and integrity', () => {
  let h: HttpHarness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(() => h.storage.reset());

  function publishBytes(bytes: Buffer, rawLength: number): void {
    h.storage.bytes = bytes;
    Object.assign(manifestOf(h).bundle, {
      compressedSizeBytes: bytes.length,
      uncompressedSizeBytes: rawLength,
      sha256: digest(bytes),
    });
  }
  function publishJson(graph: unknown): void {
    const raw = Buffer.from(JSON.stringify(graph));
    publishBytes(gzipSync(raw), raw.length);
  }

  it('fetches manifest, follows its URL, hashes compressed bytes and decompresses graph 2.1.0', async () => {
    const status = await statusOf(h);
    const result = await inspectDownload(
      status,
      h.storage.now,
      h.storage.origin,
    );
    expect(result.bytes.equals(h.storage.bytes)).toBe(true);
    expect(digest(result.bytes)).toBe(status.manifest.bundle.sha256);
    expect(result.bytes.length).toBe(
      status.manifest.bundle.compressedSizeBytes,
    );
    expect(result.graph).toEqual(fixtureGraph(h.storage.now));
    expect(result).toMatchObject({
      qualificationStatus: 'UNVERIFIED',
      canAttemptStrictRouting: false,
    });
    expect(status).toMatchObject({
      strictRoutingReady: false,
      canAttemptStrictRouting: false,
    });
  });

  it.each([
    ['NOT_FOUND', 'DOWNLOAD_HTTP_404'],
    ['UNAVAILABLE', 'DOWNLOAD_HTTP_503'],
    ['SERVER_ERROR', 'DOWNLOAD_HTTP_500'],
    ['CONTENT_TYPE', 'DOWNLOAD_CONTENT_TYPE'],
    ['ABORT', 'DOWNLOAD_TRANSPORT'],
  ] as const)(
    'detects download fault %s after a successful manifest request',
    async (fault, reason) => {
      const status = await statusOf(h);
      h.storage.fault = fault;
      await expect(
        inspectDownload(status, h.storage.now, h.storage.origin),
      ).rejects.toThrow(reason);
      expect(status.strictRoutingReady).toBe(false);
      expect(status.canAttemptStrictRouting).toBe(false);
    },
  );

  it('expires the issued fixture URL without waiting or changing JWT time', async () => {
    const status = await statusOf(h);
    h.storage.now += 900_000;
    const response = await fetch(status.download.url);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('EXPIRED_FIXTURE_URL');
    // Consumer timestamp stays at original evaluation time to exercise download expiry boundary.
    await expect(
      inspectDownload(status, h.storage.now - 900_000, h.storage.origin),
    ).rejects.toThrow('DOWNLOAD_HTTP_403');
    expect(status.strictRoutingReady).toBe(false);
  });

  it.each(['signature', 'path', 'expires', 'missing-signature'])(
    'rejects fixture URL tampering: %s',
    async (part) => {
      const status = await statusOf(h);
      const url = new URL(status.download.url);
      if (part === 'signature')
        url.searchParams.set('signature', '0'.repeat(64));
      if (part === 'path')
        url.pathname = url.pathname.replace(
          'http_demo_fixture_v1',
          'other_version',
        );
      if (part === 'expires')
        url.searchParams.set('expires', String(h.storage.now + 1800_000));
      if (part === 'missing-signature') url.searchParams.delete('signature');
      status.download.url = url.href;
      const response = await fetch(url);
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('INVALID_FIXTURE_SIGNATURE');
      await expect(
        inspectDownload(status, h.storage.now, h.storage.origin),
      ).rejects.toThrow('DOWNLOAD_HTTP_403');
    },
  );

  it('detects same-length corruption by SHA-256 on bytes actually received', async () => {
    const status = await statusOf(h);
    h.storage.bytes = Buffer.from(h.storage.bytes);
    h.storage.bytes[20] ^= 1;
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('SHA256_MISMATCH');
    expect(status.canAttemptStrictRouting).toBe(false);
  });

  it('detects truncated but completed HTTP body by compressed length', async () => {
    const status = await statusOf(h);
    h.storage.bytes = h.storage.bytes.subarray(0, h.storage.bytes.length - 8);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('COMPRESSED_LENGTH');
  });

  it('detects a syntactically valid wrong manifest digest even though API returns 200', async () => {
    manifestOf(h).bundle.sha256 = '0'.repeat(64);
    const status = await statusOf(h);
    expect(status.strictRoutingReady).toBe(false);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('SHA256_MISMATCH');
  });

  it.each([
    [
      'unsupported graph version',
      (g: ReturnType<typeof fixtureGraph>) => ({
        ...g,
        contractVersion: '9.0.0',
      }),
      'GRAPH_CONTRACT_VERSION',
    ],
    [
      'mismatched graph identity',
      (g: ReturnType<typeof fixtureGraph>) => ({
        ...g,
        graphVersion: 'old_graph_same_edges',
      }),
      'GRAPH_VERSION_MISMATCH',
    ],
    [
      'wrong vehicle profile',
      (g: ReturnType<typeof fixtureGraph>) => ({
        ...g,
        vehicleProfile: 'other_vehicle',
      }),
      'GRAPH_PROFILE_MISMATCH',
    ],
    [
      'missing edge qualification',
      (g: ReturnType<typeof fixtureGraph>) => ({
        ...g,
        edges: g.edges.map(({ compatibilityStatus: _ignored, ...e }) => e),
      }),
      'EDGE_QUALIFICATION',
    ],
    [
      'malformed graph schema',
      () => [{ padding: 'invalid-schema'.repeat(100) }],
      'GRAPH_SCHEMA',
    ],
  ] as const)(
    'rejects %s after valid byte-level integrity',
    async (_name, change, reason) => {
      publishJson(change(fixtureGraph(h.storage.now)));
      const status = await statusOf(h);
      expect(status.strictRoutingReady).toBe(false);
      await expect(
        inspectDownload(status, h.storage.now, h.storage.origin),
      ).rejects.toThrow(reason);
    },
  );

  it('detects valid gzip containing malformed JSON', async () => {
    const raw = Buffer.from('{not-json'.repeat(100));
    publishBytes(gzipSync(raw), raw.length);
    const status = await statusOf(h);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('GRAPH_JSON');
  });

  it('detects invalid gzip even when its length and digest match the manifest', async () => {
    publishBytes(Buffer.alloc(512, 65), 1024);
    const status = await statusOf(h);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('INVALID_GZIP');
  });

  it('checks decompressed length independently of compressed integrity', async () => {
    manifestOf(h).bundle.uncompressedSizeBytes++;
    const status = await statusOf(h);
    await expect(
      inspectDownload(status, h.storage.now, h.storage.origin),
    ).rejects.toThrow('UNCOMPRESSED_LENGTH');
  });
});
