import { IsString, IsEmail, IsOptional, MinLength, MaxLength, ValidateIf, IsEnum } from 'class-validator';
import { UserRole } from '../../users/enums/user-role.enum';

export class RegisterDto {
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ValidateIf(o => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf(o => !o.email)
  @IsString()
  @MinLength(8)
  @MaxLength(15)
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
