import { IsNotEmpty, IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { TeamStatus } from '../../common/enums/team.enum';

export class CreateRescueTeamDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsUUID()
  leaderId: string;

  @IsOptional()
  @IsEnum(TeamStatus)
  status?: TeamStatus;
}
