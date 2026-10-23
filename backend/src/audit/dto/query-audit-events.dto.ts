import { IsOptional, IsString } from "class-validator";

export class QueryAuditEventsDto {
  @IsOptional()
  @IsString()
  readonly from?: string;

  @IsOptional()
  @IsString()
  readonly to?: string;

  @IsOptional()
  @IsString()
  readonly appointmentId?: string;

  @IsOptional()
  @IsString()
  readonly actorId?: string;

  @IsOptional()
  @IsString()
  readonly action?: string;

  @IsOptional()
  @IsString()
  readonly limit?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;
}
