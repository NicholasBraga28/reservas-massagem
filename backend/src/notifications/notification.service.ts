import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { NotificationQueryDto } from "./dto/notification-query.dto";

type NotificationPayload = {
  id: string;
  kind: string;
  recipientId: string;
  appointmentId: string | null;
  scheduledFor: Date;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(recipientId: string, query: NotificationQueryDto) {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId, ...(query.status ? { status: query.status } : {}) },
      orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return {
      items: notifications.map(({ id, appointmentId, kind, status, scheduledFor, spokenText }) => ({
        id,
        appointmentId,
        kind,
        status,
        scheduledFor,
        spokenText,
      })),
      nextCursor: notifications.length === query.limit ? (notifications.at(-1)?.id ?? null) : null,
      spokenText: `Você tem ${notifications.length} ${notifications.length === 1 ? "aviso" : "avisos"}.`,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDue() {
    if (this.running) return;
    this.running = true;
    try {
      const webhook = process.env.NOTIFICATION_WEBHOOK_URL?.trim();
      if (!webhook) return;
      const pending = await this.prisma.notification.findMany({
        where: { status: NotificationStatus.PENDING, scheduledFor: { lte: this.clock.now() } },
        orderBy: { scheduledFor: "asc" },
        take: 50,
      });
      for (const notification of pending) await this.deliver(webhook, notification);
    } finally {
      this.running = false;
    }
  }

  private async deliver(webhook: string, notification: NotificationPayload) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "notification", ...notification }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`webhook_http_${response.status}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: this.clock.now(), error: null },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 500) : "unknown_error";
      this.logger.warn(`Falha ao entregar notificação ${notification.id}: ${reason}`);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, error: reason },
      });
    }
  }
}
