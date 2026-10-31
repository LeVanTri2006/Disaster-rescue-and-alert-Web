import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';
import { UpdateRescueRequestDto } from './dto/update-rescue-request.dto';
import { QueryRescueRequestDto } from './dto/query-rescue-request.dto';
import { RescueRequestStatus } from '../common/enums/rescue-request.enum';

@Injectable()
export class RescueRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createRescueRequestDto: CreateRescueRequestDto) {
    // Check if the user already has an active rescue request
    const pendingRequests = await this.prisma.db.orm.public.RescueRequest
      .where({
        requesterId: userId,
        status: RescueRequestStatus.PENDING,
      })
      .first();

    const assignedRequests = await this.prisma.db.orm.public.RescueRequest
      .where({
        requesterId: userId,
        status: RescueRequestStatus.ASSIGNED,
      })
      .first();
      
    const inProgressRequests = await this.prisma.db.orm.public.RescueRequest
      .where({
        requesterId: userId,
        status: RescueRequestStatus.IN_PROGRESS,
      })
      .first();

    if (pendingRequests || assignedRequests || inProgressRequests) {
      throw new BadRequestException('User already has an active rescue request');
    }

    const { latitude, longitude, peopleCount, urgency, description } = createRescueRequestDto;

    // Use raw SQL to insert geometry
    const rawSql = (this.prisma.db as any).raw.sql`
      INSERT INTO "public"."rescueRequest" (
        "id",
        "requesterId",
        "location",
        "peopleCount",
        "urgency",
        "description",
        "status",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${userId},
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
        ${peopleCount ?? 1},
        ${urgency}::"public"."Severity",
        ${description || null},
        'PENDING'::"public"."RescueRequestStatus",
        NOW(),
        NOW()
      )
      RETURNING *;
    `.returnsRow({
      id: 'pg/text@1',
      requesterId: 'pg/text@1',
      peopleCount: 'pg/int4@1',
      urgency: 'pg/text@1',
      description: 'pg/text@1',
      status: 'pg/text@1'
    }).build();

    const result = await this.prisma.db.runtime().query(rawSql);
    
    if (!result || !result[0]) {
      throw new BadRequestException('Failed to create rescue request');
    }
    
    return result[0];
  }

  async findAll(query: QueryRescueRequestDto, userId?: string) {
    const { status, urgency, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    let dbQuery: any = this.prisma.db.orm.public.RescueRequest;
    if (status) dbQuery = dbQuery.where({ status });
    if (urgency) dbQuery = dbQuery.where({ urgency });
    if (userId) dbQuery = dbQuery.where({ requesterId: userId });

    // Assuming we don't have .skip() .take() easily accessible in Prisma 8 abstract, we'll fetch all and slice or rely on raw. 
    // Wait, let's fetch all and slice for now if native methods aren't known, or use basic array methods.
    const allRecords = await dbQuery.all();
    const data = allRecords.slice(skip, skip + limit);
    const total = allRecords.length;

    return { data, total, page, limit };
  }

  async findNearby(lat: number, lon: number, radiusInMeters: number) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new BadRequestException('Invalid coordinates');
    }
    if (radiusInMeters <= 0 || radiusInMeters > 100000) { // Max 100km
      throw new BadRequestException('Invalid radius. Must be between 1 and 100000 meters.');
    }

    // Convert coordinates to geography for accurate distance calculation in meters
    const rawSql = (this.prisma.db as any).raw.sql`
      SELECT id, "requesterId", "sosEventId", "peopleCount", urgency, description, status, "createdAt"::text, "updatedAt"::text,
             ST_X(location::geometry) as longitude,
             ST_Y(location::geometry) as latitude,
             ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography) as distance
      FROM "public"."rescueRequest"
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${radiusInMeters}
      )
      ORDER BY distance ASC
      LIMIT 100
    `.returnsRow({
      id: 'pg/text@1',
      requesterId: 'pg/text@1',
      sosEventId: 'pg/text@1',
      peopleCount: 'pg/int4@1',
      urgency: 'pg/text@1',
      description: 'pg/text@1',
      status: 'pg/text@1',
      createdAt: 'pg/text@1',
      updatedAt: 'pg/text@1',
      longitude: 'pg/float8@1',
      latitude: 'pg/float8@1',
      distance: 'pg/float8@1'
    }).build();

    const results = await this.prisma.db.runtime().query(rawSql);
    return results.map((row: any) => ({
      ...row,
      location: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude]
      }
    }));
  }

  async findOne(id: string) {
    const request = await this.prisma.db.orm.public.RescueRequest.first({ id });
    if (!request) {
      throw new NotFoundException('Rescue request not found');
    }
    return request;
  }

  async update(id: string, userId: string, isAdminOrModerator: boolean, updateDto: UpdateRescueRequestDto) {
    const request = await this.findOne(id);

    if (request.requesterId !== userId && !isAdminOrModerator) {
      throw new ForbiddenException('You do not have permission to update this rescue request');
    }

    const updates: any = {};
    if (updateDto.peopleCount !== undefined) updates.peopleCount = updateDto.peopleCount;
    if (updateDto.urgency !== undefined) updates.urgency = updateDto.urgency;
    if (updateDto.description !== undefined) updates.description = updateDto.description;

    if (updateDto.status) {
      // Valid transitions:
      // PENDING -> ASSIGNED -> IN_PROGRESS -> RESOLVED
      // Any active -> CANCELLED
      
      const currentStatus = request.status;
      const newStatus = updateDto.status;
      let validTransition = false;
      
      if (isAdminOrModerator) {
        validTransition = true; // Admins can bypass strict transitions
      } else {
        if (newStatus === RescueRequestStatus.CANCELLED && currentStatus !== RescueRequestStatus.RESOLVED && currentStatus !== RescueRequestStatus.CANCELLED) {
          validTransition = true;
        } else if (currentStatus === RescueRequestStatus.PENDING && newStatus === RescueRequestStatus.ASSIGNED) {
          validTransition = true;
        } else if (currentStatus === RescueRequestStatus.ASSIGNED && newStatus === RescueRequestStatus.IN_PROGRESS) {
          validTransition = true;
        } else if (currentStatus === RescueRequestStatus.IN_PROGRESS && newStatus === RescueRequestStatus.RESOLVED) {
          validTransition = true;
        }
      }

      if (!validTransition) {
        throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }
      
      updates.status = newStatus;
    }

    if (Object.keys(updates).length > 0) {
      const updated = await this.prisma.db.orm.public.RescueRequest.where({ id }).update(updates);
      return updated;
    }
    
    // If location is provided, we need raw SQL
    if (updateDto.latitude !== undefined && updateDto.longitude !== undefined) {
      const rawSql = (this.prisma.db as any).raw.sql`
        UPDATE "public"."rescueRequest"
        SET "location" = ST_SetSRID(ST_MakePoint(${updateDto.longitude}, ${updateDto.latitude}), 4326),
            "updatedAt" = NOW()
        WHERE "id" = ${id}
        RETURNING *;
      `.returnsRow({
        id: 'pg/text@1',
        requesterId: 'pg/text@1',
        peopleCount: 'pg/int4@1',
        urgency: 'pg/text@1',
        description: 'pg/text@1',
        status: 'pg/text@1'
      }).build();
      
      const result = await this.prisma.db.runtime().query(rawSql);
      return result[0];
    }
    
    return request;
  }

  async remove(id: string, userId: string, isAdminOrModerator: boolean) {
    const request = await this.findOne(id);
    
    if (request.requesterId !== userId && !isAdminOrModerator) {
      throw new ForbiddenException('You do not have permission to delete this rescue request');
    }
    
    await this.prisma.db.orm.public.RescueRequest.where({ id }).delete();
    
    return { success: true };
  }
}
