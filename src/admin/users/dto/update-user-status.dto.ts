import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '../../../users/enums/user-status.enum';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;
}
