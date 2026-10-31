import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req, ParseFloatPipe, ParseIntPipe, ParseUUIDPipe, ForbiddenException } from '@nestjs/common';
import { RescueRequestsService } from './rescue-requests.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';
import { UpdateRescueRequestDto } from './dto/update-rescue-request.dto';
import { QueryRescueRequestDto } from './dto/query-rescue-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rescue-requests')
export class RescueRequestsController {
  constructor(private readonly rescueRequestsService: RescueRequestsService) {}

  @Post()
  async create(@Req() req: any, @Body() createRescueRequestDto: CreateRescueRequestDto) {
    const userId = req.user.id;
    const result = await this.rescueRequestsService.create(userId, createRescueRequestDto);
    return { success: true, data: result };
  }

  @Get('nearby')
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lon', ParseFloatPipe) lon: number,
    @Query('radius', ParseIntPipe) radius: number,
  ) {
    const result = await this.rescueRequestsService.findNearby(lat, lon, radius);
    return { success: true, data: result };
  }

  @Get('my')
  async findMyRequests(@Req() req: any, @Query() query: QueryRescueRequestDto) {
    const userId = req.user.id;
    const result = await this.rescueRequestsService.findAll(query, userId);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async findAll(@Query() query: QueryRescueRequestDto) {
    const result = await this.rescueRequestsService.findAll(query);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id;
    const isAdminOrModerator = req.user.role === 'ADMIN' || req.user.role === 'MODERATOR';
    const isRescuer = req.user.role === 'RESCUER';
    const request = await this.rescueRequestsService.findOne(id);
    
    // Check RBAC or Ownership
    if (request.requesterId !== userId && !isAdminOrModerator && !isRescuer) {
      throw new ForbiddenException('Forbidden');
    }
    
    return { success: true, data: request };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body() updateRescueRequestDto: UpdateRescueRequestDto,
  ) {
    const userId = req.user.id;
    const isAdminOrModerator = req.user.role === 'ADMIN' || req.user.role === 'MODERATOR';
    const result = await this.rescueRequestsService.update(id, userId, isAdminOrModerator, updateRescueRequestDto);
    return { success: true, data: result };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user.id;
    const isAdminOrModerator = req.user.role === 'ADMIN' || req.user.role === 'MODERATOR';
    await this.rescueRequestsService.remove(id, userId, isAdminOrModerator);
    return { success: true, data: null };
  }
}
