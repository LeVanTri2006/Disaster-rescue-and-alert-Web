import { Module } from '@nestjs/common';
import { RescueMissionsService } from './rescue-missions.service';
import { RescueMissionsController } from './rescue-missions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RescueMissionsController],
  providers: [RescueMissionsService],
})
export class RescueMissionsModule {}
