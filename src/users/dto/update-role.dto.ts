import { IsEnum } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateRoleDto {
  @IsEnum([UserRole.USER, UserRole.RESCUER], {
    message: 'Role must be either USER or RESCUER',
  })
  role: UserRole.USER | UserRole.RESCUER;
}
