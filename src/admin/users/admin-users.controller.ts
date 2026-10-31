import { Controller, Get, Patch, Param, Body, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async findAll(@Query() query: QueryAdminUsersDto) {
    const result = await this.adminUsersService.findAll(query);
    return { success: true, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  @Get('rescuers/approved')
  async findApprovedRescuers() {
    const result = await this.adminUsersService.findApprovedRescuers();
    return { success: true, data: result };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.adminUsersService.findById(id);
    return { success: true, data: user };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Request() req: any,
  ) {
    const updated = await this.adminUsersService.updateStatus(id, dto.status, req.user.id);
    return { success: true, data: updated };
  }
}
