import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RescueRequestStatus } from '../../common/enums/rescue-request.enum';
import { Severity } from '../../common/enums/disaster.enum';

export class QueryRescueRequestDto {
  @IsEnum(RescueRequestStatus)
  @IsOptional()
  status?: RescueRequestStatus;

  @IsEnum(Severity)
  @IsOptional()
  urgency?: Severity;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
