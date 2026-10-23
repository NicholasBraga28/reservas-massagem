import { IsOptional, IsString } from "class-validator";

export class QueryKpisDto {
  @IsOptional()
  @IsString()
  readonly from?: string;

  @IsOptional()
  @IsString()
  readonly to?: string;

  @IsOptional()
  @IsString()
  readonly locationId?: string;

  @IsOptional()
  @IsString()
  readonly therapistId?: string;

  @IsOptional()
  @IsString()
  readonly granularity?: string;
}
