import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RescueMissionsService } from './rescue-missions.service';
import { CreateRescueMissionDto } from './dto/create-rescue-mission.dto';
import { UpdateRescueMissionDto } from './dto/update-rescue-mission.dto';
import { QueryRescueMissionDto } from './dto/query-rescue-mission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rescue-missions')
export class RescueMissionsController {
  constructor(private readonly rescueMissionsService: RescueMissionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createRescueMissionDto: CreateRescueMissionDto) {
    const result = await this.rescueMissionsService.create(createRescueMissionDto);
    return { success: true, data: result };
  }

  @Post('accept/:requestId')
  @Roles(UserRole.RESCUER)
  async acceptRequest(@Req() req: any, @Param('requestId') requestId: string) {
    const rescuerId = req.user.id;
    const result = await this.rescueMissionsService.acceptRequest(requestId, rescuerId);
    return { success: true, data: result };
  }

  @Get('my')
  @Roles(UserRole.RESCUER)
  async findMyMissions(@Req() req: any, @Query() query: QueryRescueMissionDto) {
    query.rescuerId = req.user.id;
    const result = await this.rescueMissionsService.findAll(query);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async findAll(@Query() query: QueryRescueMissionDto) {
    const result = await this.rescueMissionsService.findAll(query);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const mission = await this.rescueMissionsService.findOne(id);
    const userRole = req.user.role;
    const userId = req.user.id;

    // Admin/Moderator can view any. Rescuer can view if assigned. User can view if they own the request.
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
      if (userRole === UserRole.RESCUER && mission.rescuerId !== userId) {
        throw new ForbiddenException('You can only view your assigned missions');
      }
      if (userRole === UserRole.USER && mission.request?.requesterId !== userId) {
        throw new ForbiddenException('You can only view missions for your own rescue requests');
      }
    }

    return { success: true, data: mission };
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() updateRescueMissionDto: UpdateRescueMissionDto) {
    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole === UserRole.USER) {
      throw new ForbiddenException('Users cannot update missions');
    }

    const result = await this.rescueMissionsService.update(id, updateRescueMissionDto, userRole, userId);
    return { success: true, data: result };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async remove(@Param('id') id: string) {
    await this.rescueMissionsService.remove(id);
    return { success: true };
  }
}
