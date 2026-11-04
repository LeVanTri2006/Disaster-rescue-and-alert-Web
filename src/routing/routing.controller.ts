import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { RoutingService } from './routing.service';
import { RoutingStatusResponse } from './routing.types';

@Controller('routing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESCUER, UserRole.ADMIN, UserRole.MODERATOR)
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('current')
  @Roles(UserRole.RESCUER, UserRole.ADMIN, UserRole.MODERATOR)
  async getCurrentRouting(): Promise<RoutingStatusResponse> {
    return this.routingService.getCurrentRouting();
  }
}
