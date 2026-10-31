import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { DisastersService } from './disasters.service';
import { CreateDisasterDto } from './dto/create-disaster.dto';
import { UpdateDisasterDto } from './dto/update-disaster.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { DisasterType, Severity, DisasterStatus } from '../common/enums/disaster.enum';

@Controller('disasters')
export class DisastersController {
  constructor(private readonly disastersService: DisastersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createDisasterDto: CreateDisasterDto) {
    const data = await this.disastersService.create(createDisasterDto);
    return { success: true, data };
  }

  @Get()
  async findAll(
    @Query('type') type?: DisasterType,
    @Query('severity') severity?: Severity,
    @Query('status') status?: DisasterStatus,
  ) {
    const data = await this.disastersService.findAll({ type, severity, status });
    return { success: true, data, meta: { total: data.length } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.disastersService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(@Param('id') id: string, @Body() updateDisasterDto: UpdateDisasterDto) {
    const data = await this.disastersService.update(id, updateDisasterDto);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async remove(@Param('id') id: string) {
    await this.disastersService.remove(id);
    return { success: true };
  }
}
