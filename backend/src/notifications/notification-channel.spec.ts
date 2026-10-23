import { InMemoryNotificationChannel } from "./in-memory-notification-channel";
import { NotificationMessage } from "./notification-channel";

describe("InMemoryNotificationChannel", () => {
  it("TK-05.01 RF-31 RNF-01: stores the complete accessible notification payload", async () => {
    const channel = new InMemoryNotificationChannel();
    const message: NotificationMessage = {
      recipientId: "recipient-id",
      appointmentId: "appointment-id",
      kind: "CHECK_IN_CONFIRMATION",
      message: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      spokenText: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      scheduledFor: new Date("2026-10-21T13:55:00.000Z"),
    };

    await channel.notify(message);

    expect(channel.messages).toEqual([message]);
  });
});
