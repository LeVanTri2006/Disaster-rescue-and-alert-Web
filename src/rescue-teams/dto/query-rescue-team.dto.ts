import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TeamStatus } from '../../common/enums/team.enum';

export class QueryRescueTeamDto {
  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;

  @IsOptional()
  @IsUUID()
  leaderId?: string;

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
