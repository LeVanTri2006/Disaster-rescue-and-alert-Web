import { Module } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { WarningsController } from './warnings.controller';

@Module({
  controllers: [WarningsController],
  providers: [WarningsService],
  exports: [WarningsService],
})
export class WarningsModule {}
