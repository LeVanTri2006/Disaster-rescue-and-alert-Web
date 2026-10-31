import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { TeamStatus } from '../../common/enums/team.enum';

export class UpdateRescueTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  leaderId?: string;

  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
