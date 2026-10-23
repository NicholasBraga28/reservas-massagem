import { IsDateString, IsUUID } from "class-validator";

export class CreateScheduleSlotDto {
  @IsUUID()
  readonly therapistId!: string;

  @IsUUID()
  readonly roomId!: string;

  @IsDateString()
  readonly startsAt!: string;

  @IsDateString()
  readonly endsAt!: string;
}
