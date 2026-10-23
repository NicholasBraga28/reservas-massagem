import { ConflictException, GoneException, Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationKind, Prisma, WaitlistStatus } from "@prisma/client";
import { ACTIVE_STATUSES } from "../appointments/appointment-status";
import { AppointmentEvents } from "../booking/appointment-events";
import { CLOCK, Clock } from "../common/clock/clock";
import { JoinWaitlistDto } from "./dto/join-waitlist.dto";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../domain/policy.service";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WaitlistService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly appointmentEvents: AppointmentEvents,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.appointmentEvents.onCancelled((event) => this.offerForCancelledAppointment(event.appointmentId));
  }

  async join(employeeId: string, input: JoinWaitlistDto) {
    const startsAt = new Date(input.desiredStartsAt);
    const endsAt = new Date(input.desiredEndsAt);
    this.policy.assertPeriod(startsAt, endsAt);
    this.policy.assertDuration(startsAt, endsAt);
    this.policy.assertCanBook(startsAt);
    const duplicate = await this.prisma.waitlistEntry.findFirst({
      where: {
        employeeId,
        therapistId: input.therapistId,
        desiredStartsAt: startsAt,
        desiredEndsAt: endsAt,
        status: { in: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] },
      },
    });
    if (duplicate) throw new ConflictException(messages.errors.waitlistAlreadyJoined);
    const entry = await this.prisma.waitlistEntry.create({
      data: { employeeId, therapistId: input.therapistId, desiredStartsAt: startsAt, desiredEndsAt: endsAt },
    });
    await this.audit.record(employeeId, "WAITLIST_JOINED", "WaitlistEntry", entry.id);
    return entry;
  }

  async remove(employeeId: string, id: string): Promise<void> {
    const result = await this.prisma.waitlistEntry.updateMany({
      where: { id, employeeId, status: { in: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED] } },
      data: { status: WaitlistStatus.CANCELLED },
    });
    if (result.count !== 1) throw new NotFoundException(messages.errors.waitlistEntryNotFound);
    await this.audit.record(employeeId, "WAITLIST_CANCELLED", "WaitlistEntry", id);
  }

  async accept(employeeId: string, id: string) {
    const now = this.clock.now();
    try {
      const appointment = await this.prisma.$transaction(
        async (tx) => {
          const entry = await tx.waitlistEntry.findUnique({ where: { id } });
          if (!entry || entry.employeeId !== employeeId)
            throw new NotFoundException(messages.errors.waitlistEntryNotFound);
          if (
            entry.status === WaitlistStatus.EXPIRED ||
            (entry.status === WaitlistStatus.NOTIFIED && entry.offerExpiresAt && entry.offerExpiresAt <= now)
          ) {
            await tx.waitlistEntry.updateMany({
              where: { id, status: WaitlistStatus.NOTIFIED },
              data: { status: WaitlistStatus.EXPIRED },
            });
            throw new GoneException(messages.errors.waitlistOfferExpired);
          }
          if (entry.status !== WaitlistStatus.NOTIFIED)
            throw new ConflictException(messages.errors.waitlistOfferUnavailable);
          const scheduleSlot = await tx.scheduleSlot.findFirst({
            where: {
              ...(entry.therapistId ? { therapistId: entry.therapistId } : {}),
              startsAt: { lte: entry.desiredStartsAt },
              endsAt: { gte: entry.desiredEndsAt },
              room: { active: true },
            },
            include: { room: { include: { location: true } } },
          });
          if (!scheduleSlot) throw new ConflictException(messages.errors.waitlistOfferUnavailable);
          const therapistId = scheduleSlot.therapistId;
          this.policy.assertOperatingHours(
            entry.desiredStartsAt,
            entry.desiredEndsAt,
            scheduleSlot.room.location.timezone,
          );
          const activeBookings = await tx.appointment.count({
            where: {
              employeeId,
              status: { in: [...ACTIVE_STATUSES] },
              startsAt: { gt: now },
            },
          });
          this.policy.assertWithinActiveBookingLimit(activeBookings);
          const collision = await tx.appointment.findFirst({
            where: {
              OR: [{ therapistId }, { roomId: scheduleSlot.roomId }],
              status: { in: [...ACTIVE_STATUSES] },
              startsAt: { lt: entry.desiredEndsAt },
              endsAt: { gt: entry.desiredStartsAt },
            },
          });
          if (collision) throw new ConflictException(messages.errors.waitlistOfferUnavailable);
          const claimed = await tx.waitlistEntry.updateMany({
            where: { id, employeeId, status: WaitlistStatus.NOTIFIED, offerExpiresAt: { gt: now } },
            data: { status: WaitlistStatus.CONVERTED },
          });
          if (claimed.count !== 1) throw new ConflictException(messages.errors.waitlistOfferUnavailable);
          return tx.appointment.create({
            data: {
              employeeId,
              therapistId,
              roomId: scheduleSlot.roomId,
              startsAt: entry.desiredStartsAt,
              endsAt: entry.desiredEndsAt,
              status: "CONFIRMED",
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.audit.record(employeeId, "WAITLIST_CONVERTED", "WaitlistEntry", id);
      await this.appointmentEvents.emitBooked({ appointmentId: appointment.id, employeeId });
      return appointment;
    } catch (error) {
      if (error instanceof GoneException) {
        await this.prisma.waitlistEntry.updateMany({
          where: { id, employeeId, status: WaitlistStatus.NOTIFIED },
          data: { status: WaitlistStatus.EXPIRED },
        });
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) {
        throw new ConflictException(messages.errors.waitlistOfferUnavailable);
      }
      if (isAppointmentOverlapError(error)) throw new ConflictException(messages.errors.waitlistOfferUnavailable);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOffers(): Promise<void> {
    const expired = await this.prisma.waitlistEntry.findMany({
      where: { status: WaitlistStatus.NOTIFIED, offerExpiresAt: { lte: this.clock.now() } },
      select: { id: true, desiredStartsAt: true, desiredEndsAt: true, therapistId: true },
    });
    for (const entry of expired) {
      const result = await this.prisma.waitlistEntry.updateMany({
        where: { id: entry.id, status: WaitlistStatus.NOTIFIED },
        data: { status: WaitlistStatus.EXPIRED },
      });
      if (result.count === 1) await this.offerNext(entry.desiredStartsAt, entry.desiredEndsAt, entry.therapistId);
    }
  }

  private async offerForCancelledAppointment(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) return;
    await this.offerNext(appointment.startsAt, appointment.endsAt, appointment.therapistId);
  }

  private async offerNext(startsAt: Date, endsAt: Date, therapistId: string | null): Promise<void> {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: {
        status: WaitlistStatus.WAITING,
        desiredStartsAt: { lte: startsAt },
        desiredEndsAt: { gte: endsAt },
        OR: [{ therapistId }, { therapistId: null }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!entry) return;
    const offeredAt = this.clock.now();
    const offerExpiresAt = new Date(offeredAt.getTime() + this.policy.waitlistAcceptanceMs);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.waitlistEntry.updateMany({
        where: { id: entry.id, status: WaitlistStatus.WAITING },
        data: { status: WaitlistStatus.NOTIFIED, offeredAt, offerExpiresAt },
      });
      if (result.count !== 1) return false;
      const spokenText = messages.waitlist.offer(formatSpokenDateTime(startsAt));
      await tx.notification.create({
        data: {
          recipientId: entry.employeeId,
          kind: NotificationKind.WAITLIST_VACANCY,
          scheduledFor: offeredAt,
          message: spokenText,
          spokenText,
        },
      });
      return true;
    });
    if (claimed) await this.audit.record(null, "WAITLIST_OFFERED", "WaitlistEntry", entry.id);
  }
}

function formatSpokenDateTime(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const minute = parts.minute === "00" ? "" : `:${parts.minute}`;
  return `${parts.weekday}, às ${parts.hour}h${minute}`;
}

function isAppointmentOverlapError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes("no_overlap");
}
