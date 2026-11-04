import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';

import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';

const DEFAULT_MANIFEST_KEY =
  'routing/danang/current/RoutingManifest.json';

const DEFAULT_GRAPH_PREFIX =
  'routing/danang/versions';

const GRAPH_FILE_NAME = 'BaseRoadGraph.json.gz';

const DOWNLOAD_URL_TTL_SECONDS = 900;

@Injectable()
export class RoutingStorageService {
  private readonly logger = new Logger(RoutingStorageService.name);

  private s3Client?: S3Client;

  private clientConfigFingerprint?: string;

  private getStorage() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT;
    const region = process.env.R2_REGION;

    if (
      !accessKeyId ||
      !secretAccessKey ||
      !bucketName ||
      !endpoint ||
      !region
    ) {
      throw new ServiceUnavailableException(
        'Routing object storage is not configured',
      );
    }

    const manifestKey =
      process.env.R2_ROUTING_MANIFEST_KEY?.trim() ||
      DEFAULT_MANIFEST_KEY;

    const graphPrefix = (
      process.env.R2_ROUTING_GRAPH_PREFIX?.trim() ||
      DEFAULT_GRAPH_PREFIX
    ).replace(/\/+$/, '');

    if (
      manifestKey.startsWith('/') ||
      manifestKey.includes('..') ||
      graphPrefix.startsWith('/') ||
      graphPrefix.includes('..')
    ) {
      throw new InternalServerErrorException(
        'Invalid routing object storage configuration',
      );
    }

    // Compare the complete configuration without retaining raw credentials
    // in a separate cache key.
    const configFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          endpoint,
          region,
          bucketName,
          accessKeyId,
          secretAccessKey,
        }),
      )
      .digest('hex');

    if (
      !this.s3Client ||
      this.clientConfigFingerprint !== configFingerprint
    ) {
      this.s3Client?.destroy();

      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      this.clientConfigFingerprint = configFingerprint;
    }

    return {
      client: this.s3Client,
      bucketName,
      manifestKey,
      graphPrefix,
    };
  }

  /**
   * Reads the currently published routing manifest from R2.
   * The returned object is parsed JSON, not a trusted routing contract yet.
   * RoutingService must validate its schema before using it.
   */
  async getCurrentManifest(): Promise<unknown> {
    const { client, bucketName, manifestKey } = this.getStorage();

    let response;

    try {
      response = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: manifestKey,
        }),
      );
    } catch (error) {
      const awsError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };

      if (
        awsError.name === 'NoSuchKey' ||
        awsError.name === 'NotFound' ||
        awsError.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(
          'Published routing manifest was not found',
        );
      }

      this.logger.error(
        'Failed to read routing manifest from R2',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to retrieve routing manifest',
      );
    }

    if (!response.Body) {
      throw new InternalServerErrorException(
        'Routing manifest object has an empty body',
      );
    }

    let manifestText: string;

    try {
      manifestText = await response.Body.transformToString('utf-8');
    } catch (error) {
      this.logger.error(
        'Failed to read routing manifest body',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to read routing manifest',
      );
    }

    try {
      return JSON.parse(manifestText);
    } catch {
      throw new InternalServerErrorException(
        'Published routing manifest contains invalid JSON',
      );
    }
  }

  /**
   * Creates a temporary download URL for a specific immutable graph version.
   * The object key is generated internally; callers cannot supply arbitrary keys.
   */
  async createGraphDownloadUrl(
    graphVersion: string,
    expectedSizeBytes: number,
  ): Promise<{
    url: string;
    expiresIn: number;
  }> {
    if (
      typeof graphVersion !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(graphVersion)
    ) {
      throw new InternalServerErrorException(
        'Invalid graph version in routing manifest',
      );
    }

    if (
      !Number.isSafeInteger(expectedSizeBytes) ||
      expectedSizeBytes <= 0
    ) {
      throw new InternalServerErrorException(
        'Invalid graph bundle size in routing manifest',
      );
    }

    const { client, bucketName, graphPrefix } = this.getStorage();

    const objectKey =
      `${graphPrefix}/${graphVersion}/${GRAPH_FILE_NAME}`;

    let head;

    try {
      head = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        }),
      );
    } catch (error) {
      const awsError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };

      if (
        awsError.name === 'NotFound' ||
        awsError.name === 'NoSuchKey' ||
        awsError.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(
          'Routing graph bundle was not found in object storage',
        );
      }

      this.logger.error(
        'Failed to inspect routing graph object',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to inspect routing graph bundle',
      );
    }

    if (head.ContentLength !== expectedSizeBytes) {
      throw new ConflictException(
        'Stored routing graph size does not match manifest',
      );
    }

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ResponseContentType: 'application/gzip',
        ResponseContentDisposition:
          `attachment; filename="${GRAPH_FILE_NAME}"`,
      });

      const url = await getSignedUrl(client, command, {
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      });

      return {
        url,
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      };
    } catch (error) {
      this.logger.error(
        'Failed to create routing graph download URL',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Unable to create routing graph download URL',
      );
    }
  }

  onModuleDestroy(): void {
    this.s3Client?.destroy();
    this.s3Client = undefined;
    this.clientConfigFingerprint = undefined;
  }
}
