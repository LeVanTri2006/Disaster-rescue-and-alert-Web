import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Severity } from '../../common/enums/disaster.enum';

export class CreateSosDto {
  @IsInt()
  @Min(0)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;

  @IsInt()
  @Min(0)
  elderly: number;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  neededItems?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  condition: string;

  @IsString()
  @MaxLength(4000)
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  accuracyMeters?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  batteryPercent?: number;

  @IsEnum(Severity)
  @IsOptional()
  urgency?: Severity;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];
}
