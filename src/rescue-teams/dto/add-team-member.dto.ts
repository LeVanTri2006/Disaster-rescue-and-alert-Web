import { IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { TeamMemberRole } from '../../common/enums/team.enum';

export class AddTeamMemberDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;
}
