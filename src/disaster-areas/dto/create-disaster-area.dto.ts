import { IsUUID, IsEnum, IsInt, IsOptional, IsNotEmpty, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Severity } from '../../common/enums/disaster.enum';

class GeoJSONPolygon {
  @IsNotEmpty()
  type: 'Polygon';

  @IsNotEmpty()
  coordinates: number[][][]; // GeoJSON format: array of linear rings
}

export class CreateDisasterAreaDto {
  @IsUUID()
  @IsNotEmpty()
  disasterId: string;

  @IsEnum(Severity)
  @IsNotEmpty()
  severity: Severity;

  @IsInt()
  @Min(0)
  @IsOptional()
  population?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => GeoJSONPolygon)
  area: GeoJSONPolygon;
}
