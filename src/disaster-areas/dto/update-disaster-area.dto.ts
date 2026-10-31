import { PartialType } from '@nestjs/mapped-types';
import { CreateDisasterAreaDto } from './create-disaster-area.dto';

export class UpdateDisasterAreaDto extends PartialType(CreateDisasterAreaDto) {}
