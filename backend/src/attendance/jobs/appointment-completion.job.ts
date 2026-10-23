import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AppointmentStatus } from "@prisma/client";
import { assertTransitionAllowed } from "../../appointments/appointment-status";
import { CLOCK, Clock } from "../../common/clock/clock";
import { PrismaService } from "../../prisma/prisma.service";

type InProgressAppointment = Readonly<{
  id: string;
  status: AppointmentStatus;
}>;

@Injectable()
export class AppointmentCompletionJob {
  private readonly logger = new Logger(AppointmentCompletionJob.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now();
      const appointments = await this.findExpiredAppointments(now);
      for (const appointment of appointments) await this.completeAppointment(appointment, now);
    } finally {
      this.running = false;
    }
  }

  private async findExpiredAppointments(now: Date): Promise<InProgressAppointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        endsAt: { lte: now },
        sessionEndedAt: null,
        OR: [{ status: "IN_PROGRESS" }, { status: "CHECKED_IN", sessionStartedAt: null }],
      },
      select: { id: true, status: true },
      orderBy: { endsAt: "asc" },
    });
  }

  private async completeAppointment(appointment: InProgressAppointment, endedAt: Date): Promise<void> {
    try {
      assertTransitionAllowed(appointment.id, { from: appointment.status, to: "COMPLETED", actor: "SYSTEM" });
      await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.appointment.updateMany({
          where: {
            id: appointment.id,
            status: appointment.status,
            endsAt: { lte: endedAt },
            sessionEndedAt: null,
            ...(appointment.status === "CHECKED_IN" ? { sessionStartedAt: null } : {}),
          },
          data: { status: "COMPLETED", sessionEndedAt: endedAt },
        });
        if (updated.count !== 1 || appointment.status !== "CHECKED_IN") return;
        await transaction.auditEvent.create({
          data: {
            actorId: null,
            action: "SESSION_AUTO_COMPLETED",
            entityType: "Appointment",
            entityId: appointment.id,
            data: { from: "CHECKED_IN", to: "COMPLETED", actor: "SYSTEM" },
          },
        });
      });
    } catch {
      this.logger.error(`Could not complete appointmentId=${appointment.id}`);
    }
  }
}
