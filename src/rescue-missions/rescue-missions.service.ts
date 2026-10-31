import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueMissionDto } from './dto/create-rescue-mission.dto';
import { UpdateRescueMissionDto } from './dto/update-rescue-mission.dto';
import { QueryRescueMissionDto } from './dto/query-rescue-mission.dto';
import { MissionStatus } from '../common/enums/mission-status.enum';
import { RescueRequestStatus } from '../common/enums/rescue-request.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';

@Injectable()
export class RescueMissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private canTransition(from: MissionStatus, to: MissionStatus): boolean {
    if (from === to) return true;

    switch (from) {
      case MissionStatus.ASSIGNED:
        return [MissionStatus.IN_ROUTE, MissionStatus.CANCELLED, MissionStatus.FAILED].includes(to);
      case MissionStatus.IN_ROUTE:
        return [MissionStatus.IN_PROGRESS, MissionStatus.CANCELLED, MissionStatus.FAILED].includes(to);
      case MissionStatus.IN_PROGRESS:
        return [MissionStatus.COMPLETED, MissionStatus.CANCELLED, MissionStatus.FAILED].includes(to);
      case MissionStatus.COMPLETED:
      case MissionStatus.CANCELLED:
      case MissionStatus.FAILED:
        return false; // Terminal states
      default:
        return false;
    }
  }

  async create(createDto: CreateRescueMissionDto) {
    if (!createDto.rescuerId && !createDto.teamId) {
      throw new BadRequestException('A mission must be assigned to either a rescuer or a team.');
    }
    if (createDto.rescuerId && createDto.teamId) {
      throw new BadRequestException('A mission cannot be assigned to both a rescuer and a team.');
    }

    return this.prisma.db.transaction(async (tx) => {
      // 1. Validate RescueRequest
      const request = await tx.orm.public.RescueRequest.where({ id: createDto.requestId }).first();

      if (!request) {
        throw new NotFoundException('Rescue request not found');
      }

      if ([RescueRequestStatus.RESOLVED, RescueRequestStatus.CANCELLED].includes(request.status as RescueRequestStatus)) {
        throw new BadRequestException(`Cannot assign mission to a request that is already ${request.status}`);
      }

      // 2. Check for active missions
      const requestMissions = await tx.orm.public.RescueMission.where({ requestId: createDto.requestId }).all();
      const hasActiveMission = requestMissions.some(
        (m: any) => [MissionStatus.ASSIGNED, MissionStatus.IN_ROUTE, MissionStatus.IN_PROGRESS].includes(m.status as MissionStatus)
      );

      if (hasActiveMission) {
        throw new BadRequestException('Rescue request already has an active mission');
      }

      // 3. Validate assignee
      if (createDto.rescuerId) {
        const rescuer = await tx.orm.public.User.where({ id: createDto.rescuerId }).include('rescueProfile').first();
        if (!rescuer || rescuer.role !== UserRole.RESCUER || rescuer.status !== UserStatus.ACTIVE || rescuer.rescueProfile?.verificationStatus !== 'APPROVED') {
          throw new BadRequestException('Invalid, inactive, or unverified rescuer assigned');
        }
      }

      if (createDto.teamId) {
        const team = await tx.orm.public.RescueTeam.where({ id: createDto.teamId }).first();
        if (!team || team.status !== 'ACTIVE') {
          throw new BadRequestException('Invalid or inactive team assigned');
        }
      }

      // 4. Create Mission
      const initialStatus = createDto.status || MissionStatus.ASSIGNED;
      const mission = await tx.orm.public.RescueMission.create({
        requestId: createDto.requestId,
        rescuerId: createDto.rescuerId,
        teamId: createDto.teamId,
        status: initialStatus,
        notes: createDto.notes,
      });

      // 5. Sync Request Status if applicable
      let newRequestStatus = request.status;
      if (initialStatus === MissionStatus.ASSIGNED || initialStatus === MissionStatus.IN_ROUTE) {
        newRequestStatus = RescueRequestStatus.ASSIGNED;
      } else if (initialStatus === MissionStatus.IN_PROGRESS) {
        newRequestStatus = RescueRequestStatus.IN_PROGRESS;
      } else if (initialStatus === MissionStatus.COMPLETED) {
        newRequestStatus = RescueRequestStatus.RESOLVED;
      }

      if (newRequestStatus !== request.status) {
        await tx.orm.public.RescueRequest.where({ id: request.id }).update({ status: newRequestStatus });
      }

      return mission;
    });
  }

  async findAll(query: QueryRescueMissionDto) {
    const { status, rescuerId, teamId, requestId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (rescuerId) where.rescuerId = rescuerId;
    if (teamId) where.teamId = teamId;
    if (requestId) where.requestId = requestId;

    // Prisma 8 counts
    const total = (await this.prisma.db.orm.public.RescueMission.where(where).all()).length;
    
    // Naive skip/limit using JS for now, since `.skip()` `.take()` is not clearly documented for this ORM in the abstract
    // Wait, let's assume `.skip(skip).take(limit).all()` is supported in prisma 8 OR just use standard syntax if available, 
    // actually Prisma 8 doesn't use `skip`/`take`, let's just do `.all()` and slice, it's safer.
    let data = await this.prisma.db.orm.public.RescueMission.where(where).all();
    data = data.slice(skip, skip + limit);

    return { total, page, limit, data };
  }

  async findOne(id: string) {
    const mission = await this.prisma.db.orm.public.RescueMission.where({ id }).first();

    if (!mission) {
      throw new NotFoundException('Mission not found');
    }
    
    // Populate request manually if needed
    const request = await this.prisma.db.orm.public.RescueRequest.where({ id: mission.requestId }).first();
    return { ...mission, request };
  }

  async update(id: string, updateDto: UpdateRescueMissionDto, userRole: UserRole, userId: string) {
    return this.prisma.db.transaction(async (tx) => {
      const mission = await tx.orm.public.RescueMission.where({ id }).first();

      if (!mission) {
        throw new NotFoundException('Mission not found');
      }
      
      const request = await tx.orm.public.RescueRequest.where({ id: mission.requestId }).first();
      if (!request) {
        throw new NotFoundException('Rescue request not found');
      }

      // Rescuer authorization check
      if (userRole === UserRole.RESCUER && mission.rescuerId !== userId) {
        throw new ForbiddenException('You can only update missions assigned to you');
      }

      const updates: any = {};

      if (updateDto.notes !== undefined) {
        updates.notes = updateDto.notes;
      }

      if (userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR) {
        if (updateDto.rescuerId !== undefined) {
          const rescuer = await tx.orm.public.User.where({ id: updateDto.rescuerId }).include('rescueProfile').first();
          if (!rescuer || rescuer.role !== UserRole.RESCUER || rescuer.status !== UserStatus.ACTIVE || rescuer.rescueProfile?.verificationStatus !== 'APPROVED') {
            throw new BadRequestException('Invalid, inactive, or unverified rescuer assigned');
          }
          updates.rescuerId = updateDto.rescuerId;
        }
        if (updateDto.teamId !== undefined) updates.teamId = updateDto.teamId;
      }

      if (updateDto.status && updateDto.status !== mission.status) {
        if (!this.canTransition(mission.status as MissionStatus, updateDto.status as MissionStatus)) {
          throw new BadRequestException(`Invalid status transition from ${mission.status} to ${updateDto.status}`);
        }
        updates.status = updateDto.status;

        // Set timestamps
        if (updateDto.status === MissionStatus.IN_ROUTE) updates.acceptedAt = (globalThis as any).Temporal.Now.instant() as any;
        if (updateDto.status === MissionStatus.IN_PROGRESS) updates.startedAt = (globalThis as any).Temporal.Now.instant() as any;
        if ([MissionStatus.COMPLETED, MissionStatus.CANCELLED, MissionStatus.FAILED].includes(updateDto.status as MissionStatus)) {
          updates.completedAt = (globalThis as any).Temporal.Now.instant() as any;
        }
      }

      if (Object.keys(updates).length === 0) {
        return mission;
      }

      const updatedMission = await tx.orm.public.RescueMission.where({ id }).update(updates);

      // Synchronize request status if mission status changed
      if (updateDto.status && updateDto.status !== mission.status) {
        let newRequestStatus = request.status;
        const currentReqStatus = request.status as RescueRequestStatus;

        if (updateDto.status === MissionStatus.IN_PROGRESS) {
          newRequestStatus = RescueRequestStatus.IN_PROGRESS;
        } else if (updateDto.status === MissionStatus.COMPLETED) {
          newRequestStatus = RescueRequestStatus.RESOLVED;
        } else if ([MissionStatus.CANCELLED, MissionStatus.FAILED].includes(updateDto.status as MissionStatus)) {
          // If cancelled/failed, check if there are other active missions for this request
          const allMissions = await tx.orm.public.RescueMission.where({ requestId: mission.requestId }).all();
          const otherActiveMissions = allMissions.some((m: any) => 
            m.id !== mission.id && [MissionStatus.ASSIGNED, MissionStatus.IN_ROUTE, MissionStatus.IN_PROGRESS].includes(m.status as MissionStatus)
          );
          if (!otherActiveMissions) {
            newRequestStatus = RescueRequestStatus.PENDING;
          }
        }

        if (newRequestStatus !== currentReqStatus) {
          await tx.orm.public.RescueRequest.where({ id: request.id }).update({ status: newRequestStatus });
        }
      }

      return updatedMission;
    });
  }

  async remove(id: string) {
    const mission = await this.prisma.db.orm.public.RescueMission.where({ id }).first();
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }
    
    await this.prisma.db.orm.public.RescueMission.where({ id }).delete();
    return { success: true };
  }

  async acceptRequest(requestId: string, rescuerId: string) {
    const rescuer = await this.prisma.db.orm.public.User.where({ id: rescuerId }).first();
    if (!rescuer || rescuer.role !== UserRole.RESCUER || rescuer.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Only active rescuers can accept requests.');
    }

    // Atomic update to prevent double-accept concurrency issues
    const rawSql = (this.prisma.db as any).raw.sql`
      UPDATE "public"."rescueRequest"
      SET status = 'IN_PROGRESS',
          "updatedAt" = NOW()
      WHERE id = ${requestId} AND status = 'PENDING'
      RETURNING id::text, "requesterId"::text, status::text;
    `.returnsRow({
      id: 'pg/text@1',
      requesterId: 'pg/text@1',
      status: 'pg/text@1'
    }).build();
    
    const result = await this.prisma.db.runtime().query(rawSql);
    if (!result || result.length === 0) {
       throw new ConflictException('Yêu cầu cứu hộ này đã được Rescuer khác tiếp nhận hoặc không còn khả dụng.');
    }

    const mission = await this.prisma.db.orm.public.RescueMission.create({
      requestId,
      rescuerId,
      status: MissionStatus.IN_ROUTE,
      acceptedAt: (globalThis as any).Temporal.Now.instant() as any,
    });

    return mission;
  }
}

