import { PartialType } from '@nestjs/mapped-types';
import { CreateDisasterDto } from './create-disaster.dto';

export class UpdateDisasterDto extends PartialType(CreateDisasterDto) {}
