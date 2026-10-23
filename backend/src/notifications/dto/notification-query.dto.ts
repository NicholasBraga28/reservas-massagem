import { NotificationStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class NotificationQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  readonly status?: NotificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;

  @IsOptional()
  @IsUUID()
  readonly cursor?: string;
}
