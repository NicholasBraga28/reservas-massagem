import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { ACTIVE_STATUSES } from "../appointments/appointment-status";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../domain/policy.service";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { isRetryableTransactionError } from "../prisma/transaction-errors";
import { addLocalDays, datePartsAt, localDateTimeToUtc } from "../reports/report-date";
import { CreateScheduleSlotDto } from "./dto/create-schedule-slot.dto";
import { QuerySchedulesDto } from "./dto/query-schedules.dto";
import { ScheduleSlotDto } from "./dto/schedule-slot.dto";
import { UpdateScheduleSlotDto } from "./dto/update-schedule-slot.dto";
import { ScheduleHasAppointmentsException } from "./schedule-has-appointments.exception";

const FILTER_TIMEZONE = "America/Sao_Paulo";
const AUDIT_ENTITY = "ScheduleSlot";
const MAX_TRANSACTION_ATTEMPTS = 3;

const SCHEDULE_SLOT_SELECT = {
  id: true,
  therapistId: true,
  roomId: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
} satisfies Prisma.ScheduleSlotSelect;

type Period = Readonly<{ startsAt: Date; endsAt: Date }>;

type PlannedSlot = Period & Readonly<{ therapistId: string; roomId: string; replacedId?: string }>;

type DateRange = Readonly<{ from: Date; to: Date }>;

const overlaps = (first: Period, second: Period): boolean =>
  first.startsAt < second.endsAt && second.startsAt < first.endsAt;

const byStartsAt = (first: ScheduleSlotDto, second: ScheduleSlotDto): number =>
  first.startsAt.getTime() - second.startsAt.getTime();

const localDayRange = (date: string, timezone: string): DateRange => ({
  from: localDateTimeToUtc(date, timezone),
  to: localDateTimeToUtc(addLocalDays(date, 1), timezone),
});

const isWithinOneLocalDay = ({ startsAt, endsAt }: Period, timezone: string): boolean =>
  datePartsAt(startsAt, timezone).date === datePartsAt(endsAt, timezone).date;

const SLOT_APPOINTMENT_SELECT = {
  id: true,
  roomId: true,
  startsAt: true,
  endsAt: true,
  employee: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentSelect;

type SlotAppointment = Prisma.AppointmentGetPayload<{ select: typeof SLOT_APPOINTMENT_SELECT }>;

const isAppointmentKeptBy = (planned: PlannedSlot, appointment: SlotAppointment): boolean =>
  appointment.roomId === planned.roomId &&
  planned.startsAt <= appointment.startsAt &&
  appointment.endsAt <= planned.endsAt;

const assertNoAffectedAppointments = (appointments: readonly SlotAppointment[]): void => {
  if (appointments.length === 0) return;
  throw new ScheduleHasAppointmentsException(
    appointments.map(({ id, startsAt, endsAt, employee }) => ({ id, startsAt, endsAt, employee })),
  );
};

const auditData = (slot: ScheduleSlotDto): Prisma.InputJsonObject => ({
  therapistId: slot.therapistId,
  roomId: slot.roomId,
  startsAt: slot.startsAt.toISOString(),
  endsAt: slot.endsAt.toISOString(),
});

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async create(actorId: string, input: CreateScheduleSlotDto): Promise<ScheduleSlotDto> {
    const planned = { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) };
    await this.assertCanSchedule(planned);
    const scheduleSlot = await this.prisma.scheduleSlot.create({ data: planned, select: SCHEDULE_SLOT_SELECT });
    await this.audit.record(actorId, "SCHEDULE_SLOT_CREATED", AUDIT_ENTITY, scheduleSlot.id, auditData(scheduleSlot));
    return scheduleSlot;
  }

  async list(query: QuerySchedulesDto): Promise<ScheduleSlotDto[]> {
    const range = this.dateRange(query);
    const scheduleSlots = await this.prisma.scheduleSlot.findMany({
      where: {
        startsAt: { gte: range.from, lt: range.to },
        therapistId: query.therapistId,
        roomId: query.roomId,
        room: query.locationCode ? { location: { code: query.locationCode } } : undefined,
      },
      select: SCHEDULE_SLOT_SELECT,
    });
    return scheduleSlots.sort(byStartsAt);
  }

  async update(actorId: string, id: string, input: UpdateScheduleSlotDto): Promise<ScheduleSlotDto> {
    const scheduleSlot = await this.inSerializableTransaction(async (tx) => {
      const current = await this.findOrFail(id, tx);
      const planned = {
        therapistId: current.therapistId,
        roomId: input.roomId ?? current.roomId,
        startsAt: input.startsAt ? new Date(input.startsAt) : current.startsAt,
        endsAt: input.endsAt ? new Date(input.endsAt) : current.endsAt,
      };
      await this.assertCanSchedule({ ...planned, replacedId: id }, tx);
      const appointments = await this.activeAppointmentsOfTherapistDuring(tx, current);
      assertNoAffectedAppointments(appointments.filter((appointment) => !isAppointmentKeptBy(planned, appointment)));
      return tx.scheduleSlot.update({
        where: { id },
        data: { roomId: planned.roomId, startsAt: planned.startsAt, endsAt: planned.endsAt },
        select: SCHEDULE_SLOT_SELECT,
      });
    });
    await this.audit.record(actorId, "SCHEDULE_SLOT_UPDATED", AUDIT_ENTITY, id, auditData(scheduleSlot));
    return scheduleSlot;
  }

  async remove(actorId: string, id: string): Promise<void> {
    const removed = await this.inSerializableTransaction(async (tx) => {
      const current = await this.findOrFail(id, tx);
      assertNoAffectedAppointments(await this.activeAppointmentsOfTherapistDuring(tx, current));
      await tx.scheduleSlot.delete({ where: { id } });
      return current;
    });
    await this.audit.record(actorId, "SCHEDULE_SLOT_DELETED", AUDIT_ENTITY, id, auditData(removed));
  }

  private async findOrFail(id: string, client: Prisma.TransactionClient = this.prisma): Promise<ScheduleSlotDto> {
    const scheduleSlot = await client.scheduleSlot.findUnique({ where: { id }, select: SCHEDULE_SLOT_SELECT });
    if (!scheduleSlot) throw new NotFoundException(messages.errors.scheduleNotFound);
    return scheduleSlot;
  }

  private async inSerializableTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (attempt >= MAX_TRANSACTION_ATTEMPTS || !isRetryableTransactionError(error)) throw error;
      }
    }
  }

  private activeAppointmentsOfTherapistDuring(
    tx: Prisma.TransactionClient,
    slot: ScheduleSlotDto,
  ): Promise<SlotAppointment[]> {
    return tx.appointment.findMany({
      where: {
        therapistId: slot.therapistId,
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { lt: slot.endsAt },
        endsAt: { gt: slot.startsAt },
      },
      select: SLOT_APPOINTMENT_SELECT,
      orderBy: { startsAt: "asc" },
    });
  }

  private async assertCanSchedule(planned: PlannedSlot, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    this.policy.assertPeriod(planned.startsAt, planned.endsAt);
    const timezone = await this.findActiveRoomTimezone(planned.roomId, client);
    if (!isWithinOneLocalDay(planned, timezone)) throw new BadRequestException(messages.errors.invalidPeriod);
    await this.assertActiveTherapist(planned.therapistId, client);
    this.policy.assertScheduleOperatingHours(planned.startsAt, planned.endsAt, timezone);
    await this.assertNoOverlap(planned, timezone, client);
  }

  private async assertActiveTherapist(id: string, client: Prisma.TransactionClient): Promise<void> {
    const therapist = await client.therapist.findUnique({ where: { id }, include: { user: true } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    if (therapist.user.status !== UserStatus.ACTIVE) throw new BadRequestException(messages.errors.therapistInactive);
  }

  private async findActiveRoomTimezone(id: string, client: Prisma.TransactionClient): Promise<string> {
    const room = await client.room.findUnique({ where: { id }, include: { location: true } });
    if (!room) throw new NotFoundException(messages.errors.roomNotFound);
    if (!room.active) throw new BadRequestException(messages.errors.roomInactive);
    return room.location.timezone;
  }

  private async assertNoOverlap(
    planned: PlannedSlot,
    timezone: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const conflicting = (await this.sameDaySlotsSharingTherapistOrRoom(planned, timezone, client)).filter(
      (slot) => slot.id !== planned.replacedId && overlaps(slot, planned),
    );
    if (conflicting.some((slot) => slot.therapistId === planned.therapistId)) {
      throw new ConflictException(messages.errors.scheduleConflictTherapist);
    }
    if (conflicting.some((slot) => slot.roomId === planned.roomId)) {
      throw new ConflictException(messages.errors.scheduleConflictRoom);
    }
  }

  private sameDaySlotsSharingTherapistOrRoom(
    planned: PlannedSlot,
    timezone: string,
    client: Prisma.TransactionClient,
  ): Promise<ScheduleSlotDto[]> {
    const day = localDayRange(datePartsAt(planned.startsAt, timezone).date, timezone);
    return client.scheduleSlot.findMany({
      where: {
        OR: [{ therapistId: planned.therapistId }, { roomId: planned.roomId }],
        startsAt: { lt: day.to },
        endsAt: { gt: day.from },
      },
      select: SCHEDULE_SLOT_SELECT,
    });
  }

  private dateRange({ date, startDate = date, endDate = date }: QuerySchedulesDto): DateRange {
    if (!startDate || !endDate || endDate < startDate) throw new BadRequestException(messages.errors.invalidPeriod);
    return {
      from: localDayRange(startDate, FILTER_TIMEZONE).from,
      to: localDayRange(endDate, FILTER_TIMEZONE).to,
    };
  }
}
