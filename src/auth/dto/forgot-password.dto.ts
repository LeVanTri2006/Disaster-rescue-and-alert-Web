import { IsString, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email or phone
}
