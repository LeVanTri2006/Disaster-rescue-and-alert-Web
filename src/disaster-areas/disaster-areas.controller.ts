import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { DisasterAreasService } from './disaster-areas.service';
import { CreateDisasterAreaDto } from './dto/create-disaster-area.dto';
import { UpdateDisasterAreaDto } from './dto/update-disaster-area.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('disaster-areas')
export class DisasterAreasController {
  constructor(private readonly disasterAreasService: DisasterAreasService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createDisasterAreaDto: CreateDisasterAreaDto) {
    const data = await this.disasterAreasService.create(createDisasterAreaDto);
    return { success: true, data };
  }

  @Get()
  async findAll(@Query('disasterId') disasterId?: string) {
    const data = await this.disasterAreasService.findAll({ disasterId });
    return { success: true, data, meta: { total: data.length } };
  }

  @Get('search')
  async searchNearby(
    @Query('lon') lon: string,
    @Query('lat') lat: string,
    @Query('radius') radius: string,
  ) {
    const data = await this.disasterAreasService.searchNearby(
      parseFloat(lon),
      parseFloat(lat),
      parseFloat(radius)
    );
    return { success: true, data, meta: { total: data.length } };
  }

  @Get('intersects')
  async checkIntersects(
    @Query('lon') lon: string,
    @Query('lat') lat: string,
  ) {
    const data = await this.disasterAreasService.checkIntersects(
      parseFloat(lon),
      parseFloat(lat)
    );
    return { success: true, data, meta: { total: data.length } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.disasterAreasService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(@Param('id') id: string, @Body() updateDisasterAreaDto: UpdateDisasterAreaDto) {
    const data = await this.disasterAreasService.update(id, updateDisasterAreaDto);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async remove(@Param('id') id: string) {
    await this.disasterAreasService.remove(id);
    return { success: true };
  }
}
