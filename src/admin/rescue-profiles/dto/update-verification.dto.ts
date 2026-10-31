import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProfileVerificationStatus } from '../../../users/enums/profile-verification-status.enum';

export class UpdateVerificationDto {
  @IsNotEmpty()
  @IsEnum(ProfileVerificationStatus)
  status: ProfileVerificationStatus;
}
