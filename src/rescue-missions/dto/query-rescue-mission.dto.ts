import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MissionStatus } from '../../common/enums/mission-status.enum';

export class QueryRescueMissionDto {
  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @IsOptional()
  @IsUUID()
  rescuerId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
