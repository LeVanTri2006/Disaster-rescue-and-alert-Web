import { Module } from '@nestjs/common';
import { RescueProfilesController } from './rescue-profiles/rescue-profiles.controller';
import { RescueProfilesService } from './rescue-profiles/rescue-profiles.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';

@Module({
  controllers: [
    RescueProfilesController,
    AdminUsersController,
    AdminDashboardController,
  ],
  providers: [
    RescueProfilesService,
    AdminUsersService,
    AdminDashboardService,
  ],
})
export class AdminModule {}


