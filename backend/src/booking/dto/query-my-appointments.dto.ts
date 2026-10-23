import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { AppointmentStatus } from "@prisma/client";

const parseBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class QueryMyAppointmentsDto {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Transform(parseBoolean) includePast?: boolean;
}
