import { Module } from '@nestjs/common';
import { RescueRequestsController } from './rescue-requests.controller';
import { RescueRequestsService } from './rescue-requests.service';

@Module({
  controllers: [RescueRequestsController],
  providers: [RescueRequestsService]
})
export class RescueRequestsModule {}
