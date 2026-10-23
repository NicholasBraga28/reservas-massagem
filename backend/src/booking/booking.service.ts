import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LocationCode, NotificationKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { isRetryableTransactionError } from "../prisma/transaction-errors";
import { PolicyService } from "../domain/policy.service";
import { AuditService } from "../audit/audit.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { CreateAppointmentDto } from "../common/dto";
import { messages } from "../messages/catalog";
import {
  SLOT_OCCUPYING_STATUSES,
  StatusTransitionActor,
  assertTransitionAllowed,
} from "../appointments/appointment-status";
import { slotsForWindow } from "./slots";
import { firstNameOf } from "../common/names/first-name";
import { AppointmentEvents } from "./appointment-events";
import { QueryMyAppointmentsDto } from "./dto/query-my-appointments.dto";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../notifications/notification-channel";

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly appointmentEvents: AppointmentEvents,
    @Inject(NOTIFICATION_CHANNEL) private readonly notificationChannel: NotificationChannel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async availability(from: Date, to: Date) {
    this.policy.assertPeriod(from, to);
    return this.prisma.therapist.findMany({
      where: { user: { status: "ACTIVE" }, scheduleSlots: { some: { startsAt: { lte: to }, endsAt: { gte: from } } } },
      select: {
        id: true,
        user: { select: { name: true } },
        scheduleSlots: {
          where: { startsAt: { lt: to }, endsAt: { gt: from }, room: { active: true } },
          orderBy: { startsAt: "asc" },
          include: { room: { include: { location: true } } },
        },
        blocks: { where: { startsAt: { lt: to }, endsAt: { gt: from } }, orderBy: { startsAt: "asc" } },
        appointments: {
          where: { status: { in: [...SLOT_OCCUPYING_STATUSES] }, startsAt: { lt: to }, endsAt: { gt: from } },
          orderBy: { startsAt: "asc" },
          select: { startsAt: true, endsAt: true },
        },
      },
    });
  }

  async availableSlots(
    from: Date,
    to: Date,
    durationMinutes: number,
    therapistId?: string,
    locationCode?: LocationCode,
    includeSpokenText = false,
  ) {
    this.policy.assertPeriod(from, to);
    if (!this.policy.isAllowedDuration(durationMinutes)) throw new BadRequestException(messages.errors.invalidDuration);
    const therapists = await this.prisma.therapist.findMany({
      where: {
        user: { status: "ACTIVE" },
        ...(therapistId ? { id: therapistId } : {}),
        scheduleSlots: {
          some: {
            startsAt: { lt: to },
            endsAt: { gt: from },
            room: { active: true, ...(locationCode ? { location: { code: locationCode } } : {}) },
          },
        },
      },
      select: {
        id: true,
        user: { select: { name: true } },
        scheduleSlots: {
          where: {
            startsAt: { lt: to },
            endsAt: { gt: from },
            room: { active: true, ...(locationCode ? { location: { code: locationCode } } : {}) },
          },
          orderBy: { startsAt: "asc" },
          include: { room: { include: { location: true } } },
        },
        blocks: { where: { startsAt: { lt: to }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } },
        appointments: {
          where: { status: { in: [...SLOT_OCCUPYING_STATUSES] }, startsAt: { lt: to }, endsAt: { gt: from } },
          select: { startsAt: true, endsAt: true },
        },
      },
    });
    const slots = therapists
      .flatMap((t) =>
        t.scheduleSlots.flatMap((scheduleSlot) =>
          slotsForWindow(
            { startsAt: scheduleSlot.startsAt, endsAt: scheduleSlot.endsAt, busy: [...t.blocks, ...t.appointments] },
            { durationMinutes, stepMinutes: this.policy.slotStepMinutes, now: this.clock.now() },
          ).map((slot) => ({
            ...slot,
            therapistId: t.id,
            therapistName: t.user.name,
            roomId: scheduleSlot.roomId,
            roomName: scheduleSlot.room.name,
            location: scheduleSlot.room.location,
            ...(includeSpokenText ? { locationCode: scheduleSlot.room.location.code } : {}),
          })),
        ),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const response = { therapists: therapists.map((t) => ({ id: t.id, name: t.user.name })), slots };
    if (!includeSpokenText) return response;
    if (slots.length === 0) return { ...response, spokenText: messages.availability.noSlots };
    const firstSlot = slots[0];
    return {
      ...response,
      spokenText: messages.availability.summary(
        slots.length,
        firstNameOf(firstSlot.therapistName),
        formatSpokenHour(firstSlot.startsAt),
      ),
    };
  }

  async reserve(employeeId: string, input: CreateAppointmentDto) {
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(input.endsAt);
    this.policy.assertPeriod(startsAt, endsAt);
    this.policy.assertDuration(startsAt, endsAt);
    this.policy.assertCanBook(startsAt);

    const create = () =>
      this.prisma.$transaction(
        async (tx) => {
          const scheduleSlot = await tx.scheduleSlot.findFirst({
            where: {
              therapistId: input.therapistId,
              roomId: input.roomId,
              room: { active: true },
              startsAt: { lte: startsAt },
              endsAt: { gte: endsAt },
            },
            include: { room: { include: { location: true } } },
          });
          if (!scheduleSlot) throw new BadRequestException(messages.errors.outsideAvailability);
          this.policy.assertOperatingHours(startsAt, endsAt, scheduleSlot.room.location.timezone);
          const now = this.clock.now();
          const activeBookings = await tx.appointment.count({
            where: { employeeId, status: { in: [...SLOT_OCCUPYING_STATUSES] }, startsAt: { gt: now } },
          });
          this.policy.assertWithinActiveBookingLimit(activeBookings);
          const [block, collision] = await Promise.all([
            tx.scheduleBlock.findFirst({
              where: { therapistId: input.therapistId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
            }),
            tx.appointment.findFirst({
              where: {
                therapistId: input.therapistId,
                status: { in: [...SLOT_OCCUPYING_STATUSES] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            }),
          ]);
          const roomCollision = await tx.appointment.findFirst({
            where: {
              roomId: input.roomId,
              status: { in: [...SLOT_OCCUPYING_STATUSES] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (block || collision || roomCollision) throw new ConflictException(messages.errors.unavailable);
          const created = await tx.appointment.create({
            data: {
              employeeId,
              therapistId: input.therapistId,
              roomId: input.roomId,
              startsAt,
              endsAt,
              status: "CONFIRMED",
            },
          });
          await tx.notification.create({
            data: {
              appointmentId: created.id,
              recipientId: employeeId,
              kind: NotificationKind.BOOKING_CONFIRMATION,
              scheduledFor: now,
            },
          });
          await tx.notification.create({
            data: {
              appointmentId: created.id,
              recipientId: employeeId,
              kind: NotificationKind.REMINDER,
              scheduledFor: new Date(startsAt.getTime() - this.policy.reminderLeadMs),
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    let appointment;
    try {
      appointment = await create();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004")
        throw new ConflictException(messages.errors.unavailable);
      if (isAppointmentOverlapError(error)) throw new ConflictException(messages.errors.unavailable);
      if (!isRetryableTransactionError(error)) throw error;
      try {
        appointment = await create();
      } catch (retryError) {
        if (
          retryError instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2004"].includes(retryError.code)
        ) {
          throw new ConflictException(messages.errors.unavailable);
        }
        if (isAppointmentOverlapError(retryError)) throw new ConflictException(messages.errors.unavailable);
        throw retryError;
      }
    }
    await this.appointmentEvents.emitBooked({ appointmentId: appointment.id, employeeId });
    const details = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: {
        therapist: { include: { user: { select: { name: true } } } },
        room: { include: { location: { select: { code: true } } } },
      },
    });
    return {
      ...appointment,
      therapistName: details.therapist.user.name,
      roomName: details.room.name,
      locationCode: details.room.location.code,
      spokenText: messages.booking.confirmed(
        firstNameOf(details.therapist.user.name),
        formatSpokenDateTime(appointment.startsAt),
        details.room.name,
      ),
    };
  }

  async listMine(employeeId: string, query: QueryMyAppointmentsDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to) this.policy.assertPeriod(from, to);
    const now = this.clock.now();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        employeeId,
        ...(query.status ? { status: query.status } : {}),
        ...(from || to || query.includePast === false
          ? {
              AND: [
                ...(from || to ? [{ startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }] : []),
                ...(query.includePast === false ? [{ startsAt: { gte: now } }] : []),
              ],
            }
          : {}),
      },
      include: {
        therapist: { include: { user: { select: { name: true } } } },
        room: { include: { location: { select: { code: true } } } },
      },
      orderBy: { startsAt: "asc" },
    });
    const items = appointments.map((appointment) => ({
      id: appointment.id,
      therapistId: appointment.therapistId,
      roomId: appointment.roomId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      therapistName: appointment.therapist.user.name,
      roomName: appointment.room.name,
      locationCode: appointment.room.location.code,
    }));
    const upcoming = items.filter((appointment) => appointment.startsAt >= now);
    const past = query.includePast === false ? [] : items.filter((appointment) => appointment.startsAt < now);
    return {
      upcoming,
      past,
      spokenText: formatAppointmentsSummary(upcoming, past),
    };
  }

  async nextAppointment(employeeId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { employeeId, status: "CONFIRMED", startsAt: { gte: this.clock.now() } },
      include: {
        therapist: { include: { user: { select: { name: true } } } },
        room: { include: { location: { select: { code: true } } } },
      },
      orderBy: { startsAt: "asc" },
    });
    if (!appointment) return { appointment: null, spokenText: messages.nextAppointment.empty };
    const details = {
      id: appointment.id,
      therapistId: appointment.therapistId,
      roomId: appointment.roomId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      therapistName: appointment.therapist.user.name,
      roomName: appointment.room.name,
      locationCode: appointment.room.location.code,
      status: appointment.status,
    };
    return {
      appointment: details,
      spokenText: messages.nextAppointment.summary(
        firstNameOf(details.therapistName),
        formatSpokenDateTime(details.startsAt),
        details.roomName,
      ),
    };
  }

  async cancel(id: string, actorId: string, actor: StatusTransitionActor = "EMPLOYEE") {
    const current = await this.prisma.appointment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(messages.errors.appointmentNotFound);
    const isOwnAppointmentRequired = actor === "EMPLOYEE";
    if (isOwnAppointmentRequired && current.employeeId !== actorId)
      throw new NotFoundException(messages.errors.appointmentNotFound);
    this.policy.assertCanCancel(current.startsAt);
    assertTransitionAllowed(id, { from: current.status, to: "CANCELLED", actor });
    const updatedAt = this.clock.now();
    const result = await this.prisma.appointment.updateMany({
      where: { id, status: current.status, ...(isOwnAppointmentRequired ? { employeeId: actorId } : {}) },
      data: { status: "CANCELLED", cancelledAt: updatedAt, cancelledById: actorId },
    });
    if (result.count !== 1) throw new ConflictException(messages.errors.appointmentCannotCancel);
    const updated = await this.prisma.appointment.findUniqueOrThrow({ where: { id } });
    await this.prisma.notification.updateMany({
      where: { appointmentId: id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await this.appointmentEvents.emitCancelled({ appointmentId: id, employeeId: actorId });
    const details = await this.prisma.appointment.findUniqueOrThrow({
      where: { id },
      include: {
        therapist: { include: { user: { select: { name: true } } } },
        room: { include: { location: { select: { code: true } } } },
      },
    });
    return {
      ...updated,
      therapistName: details.therapist.user.name,
      roomName: details.room.name,
      locationCode: details.room.location.code,
      spokenText: messages.booking.cancelled(
        firstNameOf(details.therapist.user.name),
        formatSpokenDateTime(updated.startsAt),
        details.room.name,
      ),
    };
  }

  async checkIn(token: string, actorId: string) {
    const room = await this.prisma.room.findUnique({ where: { checkInToken: token } });
    if (!room || !room.active) throw new NotFoundException(messages.errors.invalidCheckIn);
    const now = this.clock.now();
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        employeeId: actorId,
        roomId: room.id,
        status: "CONFIRMED",
      },
      orderBy: { startsAt: "asc" },
    });
    if (!appointment) throw new NotFoundException(messages.errors.noAppointmentForRoom);
    try {
      this.policy.assertCanCheckIn(appointment.startsAt);
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        (error.message === messages.errors.checkInTooEarly || error.message === messages.errors.lateCheckIn)
      ) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
    assertTransitionAllowed(appointment.id, { from: appointment.status, to: "CHECKED_IN", actor: "EMPLOYEE" });
    const checkedInAt = now;
    const result = await this.prisma.appointment.updateMany({
      where: { id: appointment.id, status: appointment.status },
      data: { status: "CHECKED_IN", checkedInAt },
    });
    if (result.count !== 1) throw new ConflictException(messages.errors.checkInUnavailable);
    const details = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: {
        employee: { select: { name: true } },
        therapist: { include: { user: { select: { id: true } } } },
        room: { select: { name: true } },
      },
    });
    const dateTime = formatSpokenDateTime(details.startsAt);
    await this.notificationChannel.notify({
      appointmentId: appointment.id,
      recipientId: actorId,
      kind: NotificationKind.CHECK_IN_CONFIRMATION,
      scheduledFor: checkedInAt,
      message: messages.notifications.checkInConfirmed(dateTime, details.room.name),
      spokenText: messages.notifications.checkInConfirmed(dateTime, details.room.name),
    });
    await this.notificationChannel.notify({
      appointmentId: appointment.id,
      recipientId: details.therapist.user.id,
      kind: NotificationKind.EMPLOYEE_CHECKED_IN,
      scheduledFor: checkedInAt,
      message: messages.notifications.employeeArrived(
        firstNameOf(details.employee.name),
        formatSpokenHour(details.startsAt),
        details.room.name,
      ),
      spokenText: messages.notifications.employeeArrived(
        firstNameOf(details.employee.name),
        formatSpokenHour(details.startsAt),
        details.room.name,
      ),
    });
    await this.audit.record(actorId, "APPOINTMENT_CHECKED_IN", "Appointment", appointment.id);
    return {
      ...details,
      status: "CHECKED_IN",
      checkedInAt,
      spokenText: messages.notifications.checkInConfirmed(dateTime, details.room.name),
    };
  }
}

function formatSpokenHour(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const minute = parts.minute === "00" ? "" : `:${parts.minute}`;
  return `${parts.hour}h${minute}`;
}

function formatSpokenDateTime(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(date);
  return `${weekday}, às ${formatSpokenHour(date)}`;
}

function formatAppointmentsSummary(
  upcoming: ReadonlyArray<{ startsAt: Date; therapistName: string; roomName: string }>,
  past: ReadonlyArray<{ startsAt: Date; therapistName: string; roomName: string }>,
): string {
  if (upcoming.length > 0) {
    const appointment = upcoming[0];
    return messages.appointments.upcoming(
      upcoming.length,
      firstNameOf(appointment.therapistName),
      formatSpokenDateTime(appointment.startsAt),
      appointment.roomName,
    );
  }
  if (past.length > 0) return messages.appointments.past(past.length);
  return messages.appointments.empty;
}

function isAppointmentOverlapError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    (error.message.includes("appointments_therapist_no_overlap") ||
      error.message.includes("appointments_room_no_overlap"))
  );
}
