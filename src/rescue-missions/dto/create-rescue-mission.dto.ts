import { IsUUID, IsOptional, IsEnum, ValidateIf, IsString } from 'class-validator';
import { MissionStatus } from '../../common/enums/mission-status.enum';

export class CreateRescueMissionDto {
  @IsUUID()
  requestId: string;

  @ValidateIf((o) => !o.rescuerId)
  @IsUUID()
  teamId?: string;

  @ValidateIf((o) => !o.teamId)
  @IsUUID()
  rescuerId?: string;

  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
