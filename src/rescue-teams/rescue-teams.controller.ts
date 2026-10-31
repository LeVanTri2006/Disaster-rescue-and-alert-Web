import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { RescueTeamsService } from './rescue-teams.service';
import { CreateRescueTeamDto } from './dto/create-rescue-team.dto';
import { UpdateRescueTeamDto } from './dto/update-rescue-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { QueryRescueTeamDto } from './dto/query-rescue-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('rescue-teams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RescueTeamsController {
  constructor(private readonly rescueTeamsService: RescueTeamsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  create(@Body() createDto: CreateRescueTeamDto) {
    return this.rescueTeamsService.create(createDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.RESCUER, UserRole.USER)
  findAll(@Query() query: QueryRescueTeamDto) {
    return this.rescueTeamsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.RESCUER, UserRole.USER)
  findOne(@Param('id') id: string) {
    return this.rescueTeamsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  update(@Param('id') id: string, @Body() updateDto: UpdateRescueTeamDto) {
    return this.rescueTeamsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.rescueTeamsService.remove(id);
  }

  // --- Team Members ---

  @Post(':id/members')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.RESCUER)
  async addMember(
    @Param('id') id: string,
    @Body() addDto: AddTeamMemberDto,
    @Request() req: any
  ) {
    // IDOR check: if caller is RESCUER, they must be the leader of this team.
    if (req.user.role === UserRole.RESCUER) {
      const team = await this.rescueTeamsService.findOne(id);
      if (team.leaderId !== req.user.id) {
        throw new ForbiddenException('Only the team leader or admins can add members to this team');
      }
    }
    return this.rescueTeamsService.addMember(id, addDto);
  }

  @Patch(':id/members/:userId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.RESCUER)
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateTeamMemberDto,
    @Request() req: any
  ) {
    if (req.user.role === UserRole.RESCUER) {
      const team = await this.rescueTeamsService.findOne(id);
      if (team.leaderId !== req.user.id) {
        throw new ForbiddenException('Only the team leader or admins can update member roles');
      }
    }
    return this.rescueTeamsService.updateMemberRole(id, userId, updateDto);
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR, UserRole.RESCUER, UserRole.USER)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any
  ) {
    if (req.user.role === UserRole.RESCUER) {
      const team = await this.rescueTeamsService.findOne(id);
      if (team.leaderId !== req.user.id && req.user.id !== userId) {
        // Rescuer can only remove themselves or (if leader) remove others
        throw new ForbiddenException('Only the team leader or admins can remove other members');
      }
    } else if (req.user.role === UserRole.USER) {
        if (req.user.id !== userId) {
             throw new ForbiddenException('You can only remove yourself');
        }
    }
    return this.rescueTeamsService.removeMember(id, userId);
  }
}
