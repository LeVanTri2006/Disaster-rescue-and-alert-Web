import { IsString, IsEnum, IsOptional, IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { Severity } from '../../common/enums/disaster.enum';

export class CreateWarningDto {
  @IsUUID()
  @IsNotEmpty()
  disasterId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(Severity)
  @IsNotEmpty()
  severity: Severity;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
