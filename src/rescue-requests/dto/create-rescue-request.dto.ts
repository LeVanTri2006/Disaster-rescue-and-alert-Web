import { IsNumber, IsOptional, IsString, IsEnum, Min, Max, MinLength } from 'class-validator';
import { Severity } from '../../common/enums/disaster.enum';

export class CreateRescueRequestDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  peopleCount?: number;

  @IsEnum(Severity)
  urgency: Severity;

  @IsString()
  @MinLength(1)
  @IsOptional()
  description?: string;
}
