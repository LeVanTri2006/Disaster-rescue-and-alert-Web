import {
  Body,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SosService } from './sos.service';
import { CreateSosDto } from './dto/create-sos.dto';
import { SosPhotoUploadUrlDto } from './dto/sos-photo-upload-url.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

const allAuthenticatedRoles = [
  UserRole.USER,
  UserRole.RESCUER,
  UserRole.ADMIN,
  UserRole.MODERATOR,
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sos')
export class SosController {
  constructor(private readonly sosService: SosService) {}

  @Post()
  @Roles(...allAuthenticatedRoles)
  async create(@Req() req: any, @Body() dto: CreateSosDto) {
    const data = await this.sosService.create(req.user.id, dto);
    return { success: true, data };
  }

  @Post('photo/upload-url')
  @Roles(...allAuthenticatedRoles)
  async getUploadUrl(@Req() req: any, @Body() dto: SosPhotoUploadUrlDto) {
    const data = await this.sosService.generatePhotoUploadUrl(req.user.id, dto.contentType);
    return { success: true, data };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.sosService.findAllAdmin(status, page ? +page : 1, limit ? +limit : 20);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get('my')
  @Roles(...allAuthenticatedRoles)
  async findMy(@Req() req: any) {
    return { success: true, data: await this.sosService.findMy(req.user.id) };
  }

  @Get('active')
  @Roles(...allAuthenticatedRoles)
  async findActive() {
    return { success: true, data: await this.sosService.findActive() };
  }

  @Get('nearby')
  @Roles(UserRole.RESCUER, UserRole.ADMIN, UserRole.MODERATOR)
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lon', ParseFloatPipe) lon: number,
    @Query('radius', ParseFloatPipe) radius: number,
  ) {
    return { success: true, data: await this.sosService.findNearby(lat, lon, radius) };
  }

  @Get(':id')
  @Roles(...allAuthenticatedRoles)
  async findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.sosService.findOne(id, req.user.id, req.user.role),
    };
  }

  @Patch(':id/resolve')
  @Roles(...allAuthenticatedRoles)
  async resolve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.sosService.resolve(id, req.user.id, req.user.role),
    };
  }

  @Patch(':id/false-alarm')
  @Roles(...allAuthenticatedRoles)
  async falseAlarm(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.sosService.falseAlarm(id, req.user.id, req.user.role),
    };
  }
}
