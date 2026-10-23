import { LocationCode } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class AvailabilityQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsUUID()
  therapistId?: string;

  @IsOptional()
  @IsEnum(LocationCode)
  locationCode?: LocationCode;
}
