import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
