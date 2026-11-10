import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { S3Client } from '@aws-sdk/client-s3';

import { RoutingStorageService } from './routing-storage.service';

const ENV_KEYS = [
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT',
  'R2_REGION',
  'R2_ROUTING_MANIFEST_KEY',
  'R2_ROUTING_GRAPH_PREFIX',
] as const;

describe('RoutingStorageService', () => {
  let service: RoutingStorageService;
  let originalEnv: Record<string, string | undefined>;

  type MockableClient = S3Client & {
    send: jest.Mock;
  };

  function mockClient() {
    const storage = (
      service as unknown as {
        getStorage: () => { client: S3Client };
      }
    ).getStorage();

    const client = storage.client as MockableClient;
    const send = jest.fn();

    Object.defineProperty(client, 'send', {
      configurable: true,
      writable: true,
      value: send,
    });

    return { client, send };
  }

  beforeEach(() => {
    originalEnv = {};

    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }

    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET_NAME = 'test-routing-bucket';
    process.env.R2_ENDPOINT =
      'https://test-account.r2.cloudflarestorage.com';
    process.env.R2_REGION = 'auto';

    delete process.env.R2_ROUTING_MANIFEST_KEY;
    delete process.env.R2_ROUTING_GRAPH_PREFIX;

    service = new RoutingStorageService();
  });

  afterEach(() => {
    service.onModuleDestroy();

    for (const key of ENV_KEYS) {
      const value = originalEnv[key];

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    jest.restoreAllMocks();
  });

  it('should reject when R2 configuration is missing', async () => {
    delete process.env.R2_SECRET_ACCESS_KEY;

    await expect(
      service.getCurrentManifest(),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('should reject an invalid manifest object key', async () => {
    process.env.R2_ROUTING_MANIFEST_KEY =
      '../invalid/RoutingManifest.json';

    await expect(
      service.getCurrentManifest(),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should read and parse the current manifest', async () => {
    const { send } = mockClient();

    const manifest = {
      manifestVersion: '2.1.0',
      graphVersion: 'dn_central_real_v1',
    };

    send.mockResolvedValue({
      Body: {
        transformToString: jest.fn().mockResolvedValue(
          JSON.stringify(manifest),
        ),
      },
    });

    await expect(
      service.getCurrentManifest(),
    ).resolves.toEqual(manifest);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input.Key).toBe(
      'routing/danang/current/RoutingManifest.json',
    );
  });

  it('should return 404 when the manifest does not exist', async () => {
    const { send } = mockClient();

    send.mockRejectedValue(
      Object.assign(new Error('Missing object'), {
        name: 'NoSuchKey',
      }),
    );

    await expect(
      service.getCurrentManifest(),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject a manifest containing invalid JSON', async () => {
    const { send } = mockClient();

    send.mockResolvedValue({
      Body: {
        transformToString: jest.fn().mockResolvedValue(
          '{invalid-json',
        ),
      },
    });

    await expect(
      service.getCurrentManifest(),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should reject a manifest with an empty body', async () => {
    const { send } = mockClient();

    send.mockResolvedValue({ Body: undefined });

    await expect(
      service.getCurrentManifest(),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should reject an invalid graph version', async () => {
    await expect(
      service.createGraphDownloadUrl('../invalid', 1000),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should reject an invalid expected graph size', async () => {
    await expect(
      service.createGraphDownloadUrl(
        'dn_central_real_v1',
        0,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should return 404 when the graph bundle does not exist', async () => {
    const { send } = mockClient();

    send.mockRejectedValue(
      Object.assign(new Error('Missing graph'), {
        name: 'NotFound',
      }),
    );

    await expect(
      service.createGraphDownloadUrl(
        'dn_central_real_v1',
        1173443,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject when graph size differs from manifest', async () => {
    const { send } = mockClient();

    send.mockResolvedValue({
      ContentLength: 1173442,
    });

    await expect(
      service.createGraphDownloadUrl(
        'dn_central_real_v1',
        1173443,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should generate a presigned URL with a 900-second expiry', async () => {
    const { send } = mockClient();

    send.mockResolvedValue({
      ContentLength: 1173443,
    });

    const result = await service.createGraphDownloadUrl(
      'dn_central_real_v1',
      1173443,
    );

    expect(result.expiresIn).toBe(900);

    const url = new URL(result.url);

    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input.Key).toBe(
      'routing/danang/versions/dn_central_real_v1/BaseRoadGraph.json.gz',
    );
  });

  it('should recreate the S3 client when configuration changes', () => {
    const { client: firstClient } = mockClient();

    const destroySpy = jest.spyOn(firstClient, 'destroy');

    process.env.R2_ENDPOINT =
      'https://another-account.r2.cloudflarestorage.com';

    const secondStorage = (
      service as unknown as {
        getStorage: () => { client: S3Client };
      }
    ).getStorage();

    expect(secondStorage.client).not.toBe(firstClient);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
