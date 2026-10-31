import { PartialType } from '@nestjs/mapped-types';
import { CreateRescueRequestDto } from './create-rescue-request.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { RescueRequestStatus } from '../../common/enums/rescue-request.enum';

export class UpdateRescueRequestDto extends PartialType(CreateRescueRequestDto) {
  @IsEnum(RescueRequestStatus)
  @IsOptional()
  status?: RescueRequestStatus;
}
