import { IsNumber, Max, Min } from 'class-validator';

export class NearbySosDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @IsNumber()
  @Min(1)
  @Max(100000)
  radius: number;
}
