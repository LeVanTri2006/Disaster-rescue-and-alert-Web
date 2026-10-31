import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueTeamDto } from './dto/create-rescue-team.dto';
import { UpdateRescueTeamDto } from './dto/update-rescue-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { QueryRescueTeamDto } from './dto/query-rescue-team.dto';
import { TeamStatus, TeamMemberRole } from '../common/enums/team.enum';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class RescueTeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateRescueTeamDto) {
    return this.prisma.db.transaction(async (tx) => {
      // Validate leader is a rescuer and APPROVED
      const leader = await tx.orm.public.User.where({ id: createDto.leaderId }).include('rescueProfile').first();
      
      if (!leader) {
        throw new NotFoundException('Leader user not found');
      }
      if (leader.role !== UserRole.RESCUER || leader.rescueProfile?.verificationStatus !== 'APPROVED') {
        throw new BadRequestException('Team leader must be an APPROVED RESCUER');
      }

      // Create team
      const team = await tx.orm.public.RescueTeam.create({
        name: createDto.name,
        leaderId: createDto.leaderId,
        status: createDto.status || TeamStatus.ACTIVE,
      });

      // Add leader to team members
      await tx.orm.public.TeamMember.create({
        teamId: team.id,
        userId: createDto.leaderId,
        role: TeamMemberRole.LEADER,
      });

      return team;
    });
  }

  async findAll(query: QueryRescueTeamDto) {
    const { status, leaderId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (leaderId) where.leaderId = leaderId;

    const [data, total] = await Promise.all([
      this.prisma.db.transaction((tx) =>
        tx.orm.public.RescueTeam.where(where)
          .include('leader')
          .offset(skip)
          .limit(limit)
          .all()
      ),
      this.prisma.db.transaction(async (tx) => {
        return await tx.orm.public.RescueTeam.where(where).count();
      }),
    ]);

    const totalCount = Number(total) || 0;

    return {
      data,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(id: string) {
    const team = await this.prisma.db.transaction((tx) =>
      tx.orm.public.RescueTeam.where({ id })
        .include('leader')
        .include('members', (q) => q.include('user'))
        .first()
    );

    if (!team) {
      throw new NotFoundException(`Rescue team with ID ${id} not found`);
    }
    return team;
  }

  async update(id: string, updateDto: UpdateRescueTeamDto) {
    return this.prisma.db.transaction(async (tx) => {
      const team = await tx.orm.public.RescueTeam.where({ id }).first();
      
      if (!team) {
        throw new NotFoundException(`Rescue team with ID ${id} not found`);
      }

      const updateData: any = {};
      if (updateDto.name !== undefined) updateData.name = updateDto.name;
      if (updateDto.status !== undefined) {
        // Prevent changing to INACTIVE if currently ON_MISSION
        if (team.status === TeamStatus.ON_MISSION && updateDto.status === TeamStatus.INACTIVE) {
          throw new BadRequestException('Cannot set ON_MISSION team to INACTIVE');
        }
        updateData.status = updateDto.status;
      }

      if (updateDto.leaderId !== undefined && updateDto.leaderId !== team.leaderId) {
        // Validate new leader is an APPROVED rescuer
        const newLeader = await tx.orm.public.User.where({ id: updateDto.leaderId }).include('rescueProfile').first();
        if (!newLeader) {
          throw new NotFoundException('New leader user not found');
        }
        if (newLeader.role !== UserRole.RESCUER || newLeader.rescueProfile?.verificationStatus !== 'APPROVED') {
          throw new BadRequestException('Team leader must be an APPROVED RESCUER');
        }

        updateData.leaderId = updateDto.leaderId;

        // Demote old leader if they exist as a member
        const oldLeaderMember = await tx.orm.public.TeamMember.where({
          teamId: id,
          userId: team.leaderId,
        }).first();

        if (oldLeaderMember) {
          await tx.orm.public.TeamMember.where({ id: oldLeaderMember.id }).update({ role: TeamMemberRole.MEMBER });
        }

        // Promote or create new leader as member
        const newLeaderMember = await tx.orm.public.TeamMember.where({
          teamId: id,
          userId: updateDto.leaderId,
        }).first();

        if (newLeaderMember) {
          await tx.orm.public.TeamMember.where({ id: newLeaderMember.id }).update({ role: TeamMemberRole.LEADER });
        } else {
          await tx.orm.public.TeamMember.create({
            teamId: id,
            userId: updateDto.leaderId,
            role: TeamMemberRole.LEADER,
          });
        }
      }

      if (Object.keys(updateData).length === 0) {
        return team;
      }

      return tx.orm.public.RescueTeam.where({ id }).update(updateData);
    });
  }

  async remove(id: string) {
    return this.prisma.db.transaction(async (tx) => {
      const team = await tx.orm.public.RescueTeam.where({ id }).first();
      if (!team) {
        throw new NotFoundException(`Rescue team with ID ${id} not found`);
      }

      // Check if team is on a mission
      if (team.status === TeamStatus.ON_MISSION) {
        throw new BadRequestException('Cannot delete a team that is currently ON_MISSION');
      }

      // Cascade deletes members via Prisma schema
      await tx.orm.public.RescueTeam.where({ id }).delete();
      return { message: `Team ${id} successfully deleted` };
    });
  }

  async addMember(teamId: string, addDto: AddTeamMemberDto) {
    return this.prisma.db.transaction(async (tx) => {
      const team = await tx.orm.public.RescueTeam.where({ id: teamId }).first();
      if (!team) {
        throw new NotFoundException(`Rescue team with ID ${teamId} not found`);
      }

      const user = await tx.orm.public.User.where({ id: addDto.userId }).first();
      if (!user) {
        throw new NotFoundException(`User with ID ${addDto.userId} not found`);
      }

      const existingMember = await tx.orm.public.TeamMember.where({
        teamId,
        userId: addDto.userId,
      }).first();

      if (existingMember) {
        throw new BadRequestException('User is already a member of this team');
      }

      return tx.orm.public.TeamMember.create({
        teamId,
        userId: addDto.userId,
        role: addDto.role,
      });
    });
  }

  async updateMemberRole(teamId: string, userId: string, updateDto: UpdateTeamMemberDto) {
    return this.prisma.db.transaction(async (tx) => {
      const member = await tx.orm.public.TeamMember.where({
        teamId,
        userId,
      }).first();

      if (!member) {
        throw new NotFoundException(`Team member not found for user ${userId} in team ${teamId}`);
      }

      const team = await tx.orm.public.RescueTeam.where({ id: teamId }).first();
      if (team && team.leaderId === userId && updateDto.role !== TeamMemberRole.LEADER) {
        throw new BadRequestException('Cannot change the role of the active team leader');
      }

      return tx.orm.public.TeamMember.where({ id: member.id }).update({ role: updateDto.role });
    });
  }

  async removeMember(teamId: string, userId: string) {
    return this.prisma.db.transaction(async (tx) => {
      const member = await tx.orm.public.TeamMember.where({
        teamId,
        userId,
      }).first();

      if (!member) {
        throw new NotFoundException(`Team member not found for user ${userId} in team ${teamId}`);
      }

      const team = await tx.orm.public.RescueTeam.where({ id: teamId }).first();
      if (team && team.leaderId === userId) {
        throw new BadRequestException('Cannot remove the active team leader. Change the team leader first.');
      }

      await tx.orm.public.TeamMember.where({ id: member.id }).delete();
      return { message: `Member ${userId} successfully removed from team ${teamId}` };
    });
  }
}
