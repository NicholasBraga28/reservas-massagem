import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../domain/policy.service";
import { BlockDto } from "../common/dto";
import { BookingService } from "../booking/booking.service";
import { messages } from "../messages/catalog";
import { CLOCK, Clock } from "../common/clock/clock";
import { SLOT_OCCUPYING_STATUSES, assertTransitionAllowed } from "../appointments/appointment-status";

@Injectable()
export class TherapistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: PolicyService,
    private readonly booking: BookingService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async profile(userId: string) {
    const therapist = await this.prisma.therapist.findUnique({ where: { userId } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistProfileNotFound);
    return therapist;
  }

  async agenda(userId: string, from: Date, to: Date) {
    this.policy.assertPeriod(from, to);
    const therapist = await this.profile(userId);
    return this.prisma.appointment.findMany({
      where: {
        therapistId: therapist.id,
        startsAt: { gte: from, lt: to },
        status: { in: [...SLOT_OCCUPYING_STATUSES] },
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
    });
  }

  async next(userId: string) {
    const therapist = await this.profile(userId);
    return this.prisma.appointment.findFirst({
      where: {
        therapistId: therapist.id,
        startsAt: { gte: this.clock.now() },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
    });
  }

  async arrived(userId: string) {
    const now = this.clock.now();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const therapist = await this.profile(userId);
    return this.prisma.appointment.findMany({
      where: {
        therapistId: therapist.id,
        startsAt: { gte: from, lt: to },
        status: { in: ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"] },
      },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
    });
  }

  async cancel(userId: string, appointmentId: string) {
    const therapist = await this.profile(userId);
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, therapistId: therapist.id },
    });
    if (!appointment) throw new NotFoundException(messages.errors.appointmentNotFound);
    return this.booking.cancel(appointmentId, userId, "THERAPIST");
  }

  async block(userId: string, input: BlockDto) {
    const therapist = await this.profile(userId);
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(input.endsAt);
    this.policy.assertPeriod(startsAt, endsAt);
    const block = await this.prisma.scheduleBlock.create({
      data: { therapistId: therapist.id, startsAt, endsAt, reason: input.reason, createdById: userId },
    });
    await this.audit.record(userId, "SCHEDULE_BLOCK_CREATED", "ScheduleBlock", block.id);
    return block;
  }

  async start(userId: string, id: string) {
    const therapist = await this.profile(userId);
    const appointment = await this.prisma.appointment.findFirst({ where: { id, therapistId: therapist.id } });
    if (!appointment) throw new NotFoundException(messages.errors.appointmentNotFound);
    assertTransitionAllowed(id, { from: appointment.status, to: "IN_PROGRESS", actor: "THERAPIST" });
    const startedAt = this.clock.now();
    const result = await this.prisma.appointment.updateMany({
      where: { id, therapistId: therapist.id, status: appointment.status },
      data: { status: "IN_PROGRESS", sessionStartedAt: startedAt },
    });
    if (result.count !== 1) throw new ConflictException(messages.errors.sessionCannotStart);
    const updated = await this.prisma.appointment.findUniqueOrThrow({ where: { id } });
    await this.audit.record(userId, "SESSION_STARTED", "Appointment", id);
    return updated;
  }

  async finish(userId: string, id: string) {
    const therapist = await this.profile(userId);
    const appointment = await this.prisma.appointment.findFirst({ where: { id, therapistId: therapist.id } });
    if (!appointment) throw new NotFoundException(messages.errors.appointmentNotFound);
    assertTransitionAllowed(id, { from: appointment.status, to: "COMPLETED", actor: "THERAPIST" });
    const endedAt = this.clock.now();
    const result = await this.prisma.appointment.updateMany({
      where: { id, therapistId: therapist.id, status: appointment.status },
      data: { status: "COMPLETED", sessionEndedAt: endedAt },
    });
    if (result.count !== 1) throw new ConflictException(messages.errors.sessionNotInProgress);
    const updated = await this.prisma.appointment.findUniqueOrThrow({ where: { id } });
    await this.audit.record(userId, "SESSION_FINISHED", "Appointment", id);
    return updated;
  }
}
