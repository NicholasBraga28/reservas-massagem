import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class JoinWaitlistDto {
  @IsOptional() @IsUUID() therapistId?: string;
  @IsDateString() desiredStartsAt!: string;
  @IsDateString() desiredEndsAt!: string;
}
