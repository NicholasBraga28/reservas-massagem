import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AvailabilityDto, BlockDto } from "../common/dto";
import { PolicyService } from "../domain/policy.service";
import { messages } from "../messages/catalog";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: PolicyService,
  ) {}

  async block(input: BlockDto, actorId: string) {
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(input.endsAt);
    this.policy.assertPeriod(startsAt, endsAt);
    const therapist = await this.prisma.therapist.findUnique({ where: { id: input.therapistId } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    const block = await this.prisma.scheduleBlock.create({
      data: { therapistId: input.therapistId, startsAt, endsAt, reason: input.reason, createdById: actorId },
    });
    await this.audit.record(actorId, "SCHEDULE_BLOCK_CREATED", "ScheduleBlock", block.id);
    return block;
  }

  async addAvailability(therapistId: string, input: AvailabilityDto, actorId: string) {
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(input.endsAt);
    this.policy.assertPeriod(startsAt, endsAt);
    const therapist = await this.prisma.therapist.findUnique({ where: { id: therapistId } });
    if (!therapist) throw new NotFoundException(messages.errors.therapistNotFound);
    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, active: true },
      include: { location: true },
    });
    if (!room) throw new NotFoundException(messages.errors.invalidRoom);
    this.policy.assertOperatingHours(startsAt, endsAt, room.location.timezone);
    const scheduleSlot = await this.prisma.scheduleSlot.create({
      data: { therapistId, roomId: room.id, startsAt, endsAt },
    });
    await this.audit.record(actorId, "AVAILABILITY_CREATED", "ScheduleSlot", scheduleSlot.id);
    return scheduleSlot;
  }

  auditEvents() {
    return this.prisma.auditEvent.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
    });
  }

  async kpis(from: Date, to: Date) {
    this.policy.assertPeriod(from, to);
    const [total, completed, noShows, cancelled, waitlist] = await Promise.all([
      this.prisma.appointment.count({ where: { startsAt: { gte: from, lt: to } } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: from, lt: to }, status: "COMPLETED" } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: from, lt: to }, status: "NO_SHOW" } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: from, lt: to }, status: "CANCELLED" } }),
      this.prisma.waitlistEntry.count({ where: { createdAt: { gte: from, lt: to } } }),
    ]);
    return { total, completed, noShows, cancelled, waitlist, noShowRate: total ? noShows / total : 0 };
  }
}
