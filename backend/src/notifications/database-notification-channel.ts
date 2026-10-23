import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationChannel, NotificationMessage } from "./notification-channel";

@Injectable()
export class DatabaseNotificationChannel implements NotificationChannel {
  constructor(private readonly prisma: PrismaService) {}

  async notify(message: NotificationMessage): Promise<void> {
    if (!message.appointmentId) {
      await this.prisma.notification.create({ data: this.notificationData(message) });
      return;
    }

    try {
      await this.prisma.notification.create({ data: this.notificationData(message) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }

  private notificationData(message: NotificationMessage): Prisma.NotificationUncheckedCreateInput {
    return {
      appointmentId: message.appointmentId,
      recipientId: message.recipientId,
      kind: message.kind,
      scheduledFor: message.scheduledFor,
      message: message.message,
      spokenText: message.spokenText,
    };
  }
}
