import { IsNotEmpty, IsEnum } from 'class-validator';
import { TeamMemberRole } from '../../common/enums/team.enum';

export class UpdateTeamMemberDto {
  @IsNotEmpty()
  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;
}
