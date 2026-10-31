import { PartialType } from '@nestjs/mapped-types';
import { CreateRescueMissionDto } from './create-rescue-mission.dto';

export class UpdateRescueMissionDto extends PartialType(CreateRescueMissionDto) {}
