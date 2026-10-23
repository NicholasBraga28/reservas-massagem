import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UpdateScheduleSlotDto {
  @IsOptional()
  @IsUUID()
  readonly roomId?: string;

  @IsOptional()
  @IsDateString()
  readonly startsAt?: string;

  @IsOptional()
  @IsDateString()
  readonly endsAt?: string;
}
