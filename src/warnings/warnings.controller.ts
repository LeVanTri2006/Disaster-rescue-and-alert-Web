import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { CreateWarningDto } from './dto/create-warning.dto';
import { UpdateWarningDto } from './dto/update-warning.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { Severity } from '../common/enums/disaster.enum';

@Controller('warnings')
export class WarningsController {
  constructor(private readonly warningsService: WarningsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async create(@Body() createWarningDto: CreateWarningDto) {
    const data = await this.warningsService.create(createWarningDto);
    return { success: true, data };
  }

  @Get()
  async findAll(
    @Query('severity') severity?: Severity,
    @Query('disasterId') disasterId?: string,
    @Query('active') active?: string,
  ) {
    let isActive: boolean | undefined = undefined;
    if (active === 'true') isActive = true;
    else if (active === 'false') isActive = false;

    const data = await this.warningsService.findAll({ severity, disasterId, active: isActive });
    return { success: true, data, meta: { total: data.length } };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.warningsService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(@Param('id') id: string, @Body() updateWarningDto: UpdateWarningDto) {
    const data = await this.warningsService.update(id, updateWarningDto);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async remove(@Param('id') id: string) {
    await this.warningsService.remove(id);
    return { success: true };
  }
}
