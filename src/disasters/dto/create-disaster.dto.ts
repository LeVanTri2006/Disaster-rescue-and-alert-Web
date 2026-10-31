import { IsString, IsEnum, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { DisasterType, Severity, DisasterStatus } from '../../common/enums/disaster.enum';

export class CreateDisasterDto {
  @IsEnum(DisasterType)
  @IsNotEmpty()
  type: DisasterType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Severity)
  @IsNotEmpty()
  severity: Severity;

  @IsEnum(DisasterStatus)
  @IsOptional()
  status?: DisasterStatus;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;
}
