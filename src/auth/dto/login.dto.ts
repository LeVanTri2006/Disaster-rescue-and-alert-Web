import { IsString, IsEmail, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf(o => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf(o => !o.email)
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
