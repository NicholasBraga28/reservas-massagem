import { LocationCode } from "@prisma/client";
import { IsEnum, IsISO8601, IsOptional, IsUUID, Matches } from "class-validator";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class QuerySchedulesDto {
  @IsOptional()
  @Matches(LOCAL_DATE_PATTERN)
  @IsISO8601({ strict: true })
  readonly date?: string;

  @IsOptional()
  @Matches(LOCAL_DATE_PATTERN)
  @IsISO8601({ strict: true })
  readonly startDate?: string;

  @IsOptional()
  @Matches(LOCAL_DATE_PATTERN)
  @IsISO8601({ strict: true })
  readonly endDate?: string;

  @IsOptional()
  @IsUUID()
  readonly therapistId?: string;

  @IsOptional()
  @IsUUID()
  readonly roomId?: string;

  @IsOptional()
  @IsEnum(LocationCode)
  readonly locationCode?: LocationCode;
}
