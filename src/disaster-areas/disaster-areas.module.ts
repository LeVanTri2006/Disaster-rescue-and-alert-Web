import { Module } from '@nestjs/common';
import { DisasterAreasService } from './disaster-areas.service';
import { DisasterAreasController } from './disaster-areas.controller';

@Module({
  controllers: [DisasterAreasController],
  providers: [DisasterAreasService],
  exports: [DisasterAreasService],
})
export class DisasterAreasModule {}
