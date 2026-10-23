import { NotificationKind } from "@prisma/client";

export type NotificationMessage = Readonly<{
  recipientId: string;
  appointmentId?: string;
  kind: NotificationKind;
  message: string;
  spokenText: string;
  scheduledFor: Date;
}>;

export interface NotificationChannel {
  notify(message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_CHANNEL = Symbol("NOTIFICATION_CHANNEL");
