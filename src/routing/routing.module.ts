import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RoutingStorageService } from './storage/routing-storage.service';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';

@Module({
  imports: [AuthModule],
  controllers: [RoutingController],
  providers: [RoutingStorageService, RoutingService],
  exports: [RoutingStorageService, RoutingService],
})
export class RoutingModule {}
