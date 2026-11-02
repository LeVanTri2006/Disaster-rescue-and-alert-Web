import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../users/enums/user-role.enum';
import { Severity } from '../common/enums/disaster.enum';
import { CreateSosDto } from './dto/create-sos.dto';
import { FirebaseSosPublisher, SosRealtimeProjection } from '../firebase/firebase-sos.publisher';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type SosRole = UserRole | string;

const sosRowSpec = {
  eventId: 'pg/text@1',
  userId: 'pg/text@1',
  adults: 'pg/int4@1',
  children: 'pg/int4@1',
  elderly: 'pg/int4@1',
  totalPeople: 'pg/int4@1',
  neededItems: { codecId: 'pg/text@1', many: true },
  condition: 'pg/text@1',
  description: 'pg/text@1',
  latitude: 'pg/float8@1',
  longitude: 'pg/float8@1',
  accuracyMeters: 'pg/float8@1',
  batteryPercent: 'pg/int4@1',
  createdAt: 'pg/timestamptz-temporal@1',
  status: 'pg/text@1',
  urgency: 'pg/text@1',
  photoUrl: 'pg/text@1',
  photos: { codecId: 'pg/text@1', many: true },
  transportMode: 'pg/text@1',
} as const;

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly firebasePublisher?: FirebaseSosPublisher,
  ) {}

  async create(userId: string, dto: CreateSosDto) {
    this.validatePeople(dto);
    this.validateCoordinates(dto.latitude, dto.longitude);

    const inputPhotos = dto.photos && dto.photos.length > 0 ? dto.photos : (dto.photoUrl ? [dto.photoUrl] : []);
    if (inputPhotos.length > 3) {
      throw new BadRequestException('Maximum 3 photos allowed');
    }

    const existing = await this.prisma.db.orm.public.SOSEvent
      .where({ userId, status: 'ACTIVE' })
      .first();
    if (existing) {
      const createdTime = this.toEpochMillis(existing.createdAt);
      const isExpired = Date.now() - createdTime > 3 * 24 * 60 * 60 * 1000;
      if (isExpired) {
        await this.prisma.db.orm.public.SOSEvent
          .where({ id: existing.id })
          .update({ status: 'RESOLVED' });
      } else {
        throw new ConflictException('User already has an active SOS event');
      }
    }

    const neededItems = (dto.neededItems ?? []).map((item) => item.trim());
    const event = await this.prisma.db.transaction(async (tx) => {
      const createdEvent = await tx.orm.public.SOSEvent.create({
        userId,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        } as any,
        emergencyType: dto.condition.trim(),
        message: dto.description?.trim() || null,
        adults: dto.adults,
        children: dto.children,
        elderly: dto.elderly,
        neededItems,
        accuracyMeters: dto.accuracyMeters,
        batteryPercent: dto.batteryPercent,
        urgency: dto.urgency ?? Severity.HIGH,
        photoUrl: inputPhotos.length > 0 ? inputPhotos[0] : null,
        // The only server-backed transport in this phase is the online API.
        transportMode: 'ONLINE',
        status: 'ACTIVE',
      } as any);

      if (inputPhotos.length > 0) {
        await Promise.all(inputPhotos.map(key => 
          tx.orm.public.SOSPhoto.create({
            sosEventId: createdEvent.id,
            objectKey: key,
          } as any)
        ));
      }

      await tx.orm.public.RescueRequest.create({
        sosEventId: createdEvent.id,
        requesterId: userId,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        } as any,
        peopleCount: dto.adults + dto.children + dto.elderly,
        urgency: dto.urgency ?? Severity.HIGH,
        description: dto.description?.trim() || null,
        status: 'PENDING',
      } as any);

      return createdEvent;
    });

    const detail = await this.findOne(event.id, userId, UserRole.USER, true);
    this.publishRealtime(detail).catch(error => {
      this.logger.warn(`Unhandled rejection in publishRealtime: ${error instanceof Error ? error.message : String(error)}`);
    });
    return detail;
  }

  async generatePhotoUploadUrl(userId: string, contentType: string) {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT;
    const region = process.env.R2_REGION;

    if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint || !region) {
      throw new Error('Missing R2 environment variables');
    }

    let ext = 'jpg';
    if (contentType === 'image/png') ext = 'png';
    if (contentType === 'image/webp') ext = 'webp';

    const uuid = crypto.randomUUID();
    const objectKey = `sos/${userId}/${uuid}.${ext}`;

    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      uploadUrl,
      objectKey,
      expiresIn,
      contentType,
    };
  }

  async findMy(userId: string) {
    const plan = (this.prisma.db as any).raw.sql`
      SELECT
        e."id" AS "eventId",
        e."userId",
        e."adults",
        e."children",
        e."elderly",
        (e."adults" + e."children" + e."elderly") AS "totalPeople",
        e."neededItems",
        e."emergencyType" AS "condition",
        e."message" AS "description",
        ST_Y(e."location"::geometry) AS "latitude",
        ST_X(e."location"::geometry) AS "longitude",
        e."accuracyMeters",
        e."batteryPercent",
        e."createdAt",
        e."status",
        e."urgency",
        e."photoUrl",
        COALESCE(
          (SELECT array_agg(p."objectKey" ORDER BY p."createdAt" ASC)
           FROM "public"."sOSPhoto" p WHERE p."sosEventId" = e."id"),
          '{}'
        ) AS "photos",
        e."transportMode"
      FROM "public"."sOSEvent" e
      WHERE e."userId" = ${userId}
      ORDER BY e."createdAt" DESC
    `.returnsRow(sosRowSpec).build();
    const rows = await this.prisma.db.runtime().query(plan);
    return this.transformSosEvents(rows as any[]);
  }

  async findActive() {
    const plan = (this.prisma.db as any).raw.sql`
      SELECT
        e."id" AS "eventId",
        e."userId",
        e."adults",
        e."children",
        e."elderly",
        (e."adults" + e."children" + e."elderly") AS "totalPeople",
        e."neededItems",
        e."emergencyType" AS "condition",
        e."message" AS "description",
        ST_Y(e."location"::geometry) AS "latitude",
        ST_X(e."location"::geometry) AS "longitude",
        e."accuracyMeters",
        e."batteryPercent",
        e."createdAt",
        e."status",
        e."urgency",
        e."photoUrl",
        COALESCE(
          (SELECT array_agg(p."objectKey" ORDER BY p."createdAt" ASC)
           FROM "public"."sOSPhoto" p WHERE p."sosEventId" = e."id"),
          '{}'
        ) AS "photos",
        e."transportMode"
      FROM "public"."sOSEvent" e
      WHERE e."status" = 'ACTIVE'::text
        AND e."createdAt" >= NOW() - INTERVAL '3 days'
      ORDER BY e."createdAt" DESC
    `.returnsRow(sosRowSpec).build();
    const rows = await this.prisma.db.runtime().query(plan);
    return this.transformSosEvents(rows as any[]);
  }

  async findAllAdmin(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const statusClause = status ? `AND e."status" = '${status}'::text` : '';
    const plan = (this.prisma.db as any).raw.sql`
      SELECT
        e."id" AS "eventId",
        e."userId",
        e."adults",
        e."children",
        e."elderly",
        (e."adults" + e."children" + e."elderly") AS "totalPeople",
        e."neededItems",
        e."emergencyType" AS "condition",
        e."message" AS "description",
        ST_Y(e."location"::geometry) AS "latitude",
        ST_X(e."location"::geometry) AS "longitude",
        e."accuracyMeters",
        e."batteryPercent",
        e."createdAt",
        e."status",
        e."urgency",
        e."photoUrl",
        COALESCE(
          (SELECT array_agg(p."objectKey" ORDER BY p."createdAt" ASC)
           FROM "public"."sOSPhoto" p WHERE p."sosEventId" = e."id"),
          '{}'
        ) AS "photos",
        e."transportMode"
      FROM "public"."sOSEvent" e
      WHERE 1=1
      ORDER BY e."createdAt" DESC
    `.returnsRow(sosRowSpec).build();
    const all = await this.prisma.db.runtime().query(plan);
    const filtered = status ? (all as any[]).filter(s => s.status === status) : all as any[];
    const total = filtered.length;
    const data = await this.transformSosEvents(filtered.slice(skip, skip + limit));
    return { data, total, page, limit };
  }

  async findNearby(lat: number, lon: number, radius: number) {
    this.validateCoordinates(lat, lon);
    if (!Number.isFinite(radius) || radius < 1 || radius > 100000) {
      throw new BadRequestException('Radius must be between 1 and 100000 meters');
    }

    const plan = (this.prisma.db as any).raw.sql`
      SELECT
        e."id" AS "eventId",
        e."userId",
        e."adults",
        e."children",
        e."elderly",
        (e."adults" + e."children" + e."elderly") AS "totalPeople",
        e."neededItems",
        e."emergencyType" AS "condition",
        e."message" AS "description",
        ST_Y(e."location"::geometry) AS "latitude",
        ST_X(e."location"::geometry) AS "longitude",
        e."accuracyMeters",
        e."batteryPercent",
        e."createdAt",
        e."status",
        e."urgency",
        e."photoUrl",
        COALESCE(
          (SELECT array_agg(p."objectKey" ORDER BY p."createdAt" ASC)
           FROM "public"."sOSPhoto" p WHERE p."sosEventId" = e."id"),
          '{}'
        ) AS "photos",
        e."transportMode",
        ST_Distance(
          e."location"::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
        ) AS "distanceMeters"
      FROM "public"."sOSEvent" e
      WHERE e."status" = 'ACTIVE'::text
        AND e."createdAt" >= NOW() - INTERVAL '3 days'
        AND ST_DWithin(
          e."location"::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
          ${radius}
        )
      ORDER BY "distanceMeters" ASC
      LIMIT 100
    `.returnsRow({ ...sosRowSpec, distanceMeters: 'pg/float8@1' }).build();
    const rows = await this.prisma.db.runtime().query(plan);
    return this.transformSosEvents(rows as any[]);
  }

  async findOne(id: string, requesterId: string, role: SosRole, bypassAuthorization = false) {
    const event = await this.findOneRaw(id);
    if (!event) throw new NotFoundException('SOS event not found');

    if (!bypassAuthorization && !this.canView(event, requesterId, role)) {
      throw new ForbiddenException('You do not have permission to view this SOS event');
    }
    return this.transformSosEvent(event);
  }

  async resolve(id: string, requesterId: string, role: SosRole) {
    return this.transition(id, requesterId, role, 'RESOLVED');
  }

  async falseAlarm(id: string, requesterId: string, role: SosRole) {
    return this.transition(id, requesterId, role, 'FALSE_ALARM');
  }

  private async transition(
    id: string,
    requesterId: string,
    role: SosRole,
    nextStatus: 'RESOLVED' | 'FALSE_ALARM',
  ) {
    const current = await this.findOneRaw(id);
    if (!current) throw new NotFoundException('SOS event not found');

    const privileged = role === UserRole.ADMIN || role === UserRole.MODERATOR;
    if (!privileged && current.userId !== requesterId) {
      throw new ForbiddenException('You can only update your own SOS events');
    }
    if (current.status !== 'ACTIVE') {
      throw new BadRequestException(`Invalid SOS status transition from ${current.status} to ${nextStatus}`);
    }

    const updated = await this.prisma.db.orm.public.SOSEvent
      .where({ id, status: 'ACTIVE' })
      .update({ status: nextStatus });
    if (!updated) {
      throw new BadRequestException(`Invalid SOS status transition from ${current.status} to ${nextStatus}`);
    }

    const detail = await this.findOne(id, requesterId, role, privileged);
    this.publishRealtime(detail).catch(error => {
      this.logger.warn(`Unhandled rejection in publishRealtime: ${error instanceof Error ? error.message : String(error)}`);
    });
    return detail;
  }

  private async publishRealtime(event: any) {
    if (!this.firebasePublisher?.enabled) return;

    const projection: SosRealtimeProjection = {
      eventId: event.eventId,
      status: event.status,
      latitude: Number(event.latitude),
      longitude: Number(event.longitude),
      accuracyMeters: event.accuracyMeters == null ? null : Number(event.accuracyMeters),
      adults: Number(event.adults),
      children: Number(event.children),
      elderly: Number(event.elderly),
      neededItems: Array.isArray(event.neededItems) ? event.neededItems.map(String) : [],
      condition: event.condition ?? null,
      urgency: event.urgency ?? null,
      photoUrl: event.photoUrl ?? null,
      photos: Array.isArray(event.photos) ? event.photos : [],
      createdAt: this.toIsoString(event.createdAt),
      batteryPercent: event.batteryPercent == null ? null : Number(event.batteryPercent),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.firebasePublisher.publish(event.userId, projection);
    } catch (error) {
      // PostgreSQL remains authoritative. A projection failure is retryable and
      // must not turn a committed SOS into an HTTP 500 response.
      this.logger.warn(`Firebase projection failed for SOS ${event.eventId}`);
      this.logger.debug(error instanceof Error ? error.message : String(error));
    }
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object' && 'toString' in value) return String(value);
    return new Date(String(value)).toISOString();
  }

  private toEpochMillis(value: unknown): number {
    if (!value) return Date.now();
    if (typeof (value as any).epochMilliseconds === 'number') {
      return (value as any).epochMilliseconds;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return new Date(String(value)).getTime();
  }

  private async getPresignedGetUrl(objectKey: string): Promise<string | null> {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const endpoint = process.env.R2_ENDPOINT;
    const region = process.env.R2_REGION;

    if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint || !region) {
      return null;
    }

    const client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    try {
      return await getSignedUrl(client, command, { expiresIn: 3600 });
    } catch (error) {
      this.logger.error(`Failed to generate presigned GET url for ${objectKey}`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async transformSosEvent(event: any): Promise<any> {
    if (!event) return event;
    
    const signedPhotos: string[] = [];
    let signedPhotoUrl: string | null = null;
    
    const photosToSign: string[] = Array.isArray(event.photos) ? event.photos : [];
    
    if (photosToSign.length > 0) {
      for (const key of photosToSign) {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          signedPhotos.push(key);
        } else {
          const url = await this.getPresignedGetUrl(key);
          if (url) signedPhotos.push(url);
        }
      }
      signedPhotoUrl = signedPhotos.length > 0 ? signedPhotos[0] : null;
    } else if (event.photoUrl) {
      if (event.photoUrl.startsWith('http://') || event.photoUrl.startsWith('https://')) {
        signedPhotoUrl = event.photoUrl;
      } else {
        signedPhotoUrl = await this.getPresignedGetUrl(event.photoUrl);
      }
      if (signedPhotoUrl) {
        signedPhotos.push(signedPhotoUrl);
      }
    }

    return { ...event, photoUrl: signedPhotoUrl, photos: signedPhotos };
  }

  private async transformSosEvents(events: any[]): Promise<any[]> {
    return Promise.all(events.map(e => this.transformSosEvent(e)));
  }

  private async findOneRaw(id: string): Promise<any | null> {
    const plan = (this.prisma.db as any).raw.sql`
      SELECT
        e."id" AS "eventId",
        e."userId",
        e."adults",
        e."children",
        e."elderly",
        (e."adults" + e."children" + e."elderly") AS "totalPeople",
        e."neededItems",
        e."emergencyType" AS "condition",
        e."message" AS "description",
        ST_Y(e."location"::geometry) AS "latitude",
        ST_X(e."location"::geometry) AS "longitude",
        e."accuracyMeters",
        e."batteryPercent",
        e."createdAt",
        e."status",
        e."urgency",
        e."photoUrl",
        COALESCE(
          (SELECT array_agg(p."objectKey" ORDER BY p."createdAt" ASC)
           FROM "public"."sOSPhoto" p WHERE p."sosEventId" = e."id"),
          '{}'
        ) AS "photos",
        e."transportMode"
      FROM "public"."sOSEvent" e
      WHERE e."id" = ${id}
      LIMIT 1
    `.returnsRow(sosRowSpec).build();
    const rows = await this.prisma.db.runtime().query(plan);
    return rows[0] ?? null;
  }

  private canView(event: any, requesterId: string, role: SosRole) {
    if (role === UserRole.ADMIN || role === UserRole.MODERATOR) return true;
    if (event.userId === requesterId) return true;
    return role === UserRole.RESCUER && event.status === 'ACTIVE';
  }

  private validatePeople(dto: CreateSosDto) {
    if (dto.adults + dto.children + dto.elderly <= 0) {
      throw new BadRequestException('At least one person is required');
    }
  }

  private validateCoordinates(latitude: number, longitude: number) {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException('Invalid coordinates');
    }
  }

}
