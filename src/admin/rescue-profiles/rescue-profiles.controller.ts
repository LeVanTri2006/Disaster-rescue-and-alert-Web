import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RescueProfilesService } from './rescue-profiles.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { UpdateVerificationDto } from './dto/update-verification.dto';

@Controller('admin/rescue-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class RescueProfilesController {
  constructor(private readonly rescueProfilesService: RescueProfilesService) {}

  @Get('pending')
  async getPending() {
    const profiles = await this.rescueProfilesService.getPendingProfiles();
    return { success: true, data: profiles };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const profile = await this.rescueProfilesService.getProfileById(id);
    return { success: true, data: profile };
  }

  @Patch(':id/verification')
  async updateVerification(
    @Param('id') id: string,
    @Body() updateDto: UpdateVerificationDto,
    @Request() req: any
  ) {
    const profile = await this.rescueProfilesService.updateVerification(id, updateDto.status, req.user.id);
    return { success: true, data: profile };
  }
}
