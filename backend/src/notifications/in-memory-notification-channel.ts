import { Injectable } from "@nestjs/common";
import { NotificationChannel, NotificationMessage } from "./notification-channel";

@Injectable()
export class InMemoryNotificationChannel implements NotificationChannel {
  readonly messages: NotificationMessage[] = [];

  async notify(message: NotificationMessage): Promise<void> {
    this.messages.push(message);
  }
}
