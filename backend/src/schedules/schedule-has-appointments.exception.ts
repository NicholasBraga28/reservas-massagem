import { ConflictException, HttpStatus } from "@nestjs/common";
import { messages } from "../messages/catalog";

export type AffectedAppointment = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  employee: Readonly<{ id: string; name: string }>;
}>;

export class ScheduleHasAppointmentsException extends ConflictException {
  constructor(appointments: readonly AffectedAppointment[]) {
    super({
      statusCode: HttpStatus.CONFLICT,
      error: "Conflict",
      message: messages.errors.scheduleHasAppointments,
      appointments,
    });
  }
}
