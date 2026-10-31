import { Module } from '@nestjs/common';
import { RescueTeamsService } from './rescue-teams.service';
import { RescueTeamsController } from './rescue-teams.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RescueTeamsController],
  providers: [RescueTeamsService],
})
export class RescueTeamsModule {}
