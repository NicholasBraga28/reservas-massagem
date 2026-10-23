import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DatabaseNotificationChannel } from "./database-notification-channel";
import { NOTIFICATION_CHANNEL } from "./notification-channel";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    DatabaseNotificationChannel,
    { provide: NOTIFICATION_CHANNEL, useExisting: DatabaseNotificationChannel },
  ],
  exports: [NotificationService, NOTIFICATION_CHANNEL],
})
export class NotificationsModule {}
