import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../src/notifications/notification-channel";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";

describe("Notifications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: NotificationChannel;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    channel = app.get(NOTIFICATION_CHANNEL);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-05.01 RF-31 RNF-01: persists one accessible notification for duplicate logical deliveries", async () => {
    const employee = await prisma.user.create({
      data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });
    const therapistUser = await prisma.user.create({
      data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T14:00:00.000Z"),
        endsAt: new Date("2026-10-21T14:20:00.000Z"),
        status: "CHECKED_IN",
      },
    });

    const message = {
      recipientId: therapistUser.id,
      appointmentId: appointment.id,
      kind: "CHECK_IN_CONFIRMATION" as const,
      message: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      spokenText: "Check-in confirmado para hoje, às 11h, na Sala 1.",
      scheduledFor: new Date("2026-10-21T13:55:00.000Z"),
    };
    await channel.notify(message);
    await channel.notify(message);

    await expect(prisma.notification.findMany({ where: { appointmentId: appointment.id } })).resolves.toEqual([
      expect.objectContaining({
        recipientId: therapistUser.id,
        appointmentId: appointment.id,
        kind: "CHECK_IN_CONFIRMATION",
        status: "PENDING",
        message: message.message,
        spokenText: message.spokenText,
      }),
    ]);
  });

  it("TK-05.01 RF-31 RNF-01: lists only the therapist notifications in chronological order", async () => {
    const firstTherapist = await prisma.user.create({
      data: { email: "first@example.com", name: "First Therapist", role: "THERAPIST" },
    });
    const secondTherapist = await prisma.user.create({
      data: { email: "second@example.com", name: "Second Therapist", role: "THERAPIST" },
    });
    const employee = await prisma.user.create({
      data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });
    const firstProfile = await prisma.therapist.create({ data: { userId: firstTherapist.id } });
    const secondProfile = await prisma.therapist.create({ data: { userId: secondTherapist.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    const firstAppointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: firstProfile.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T15:00:00Z"),
        endsAt: new Date("2026-10-21T15:20:00Z"),
        status: "CONFIRMED",
      },
    });
    const secondAppointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: secondProfile.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T14:00:00Z"),
        endsAt: new Date("2026-10-21T14:20:00Z"),
        status: "CONFIRMED",
      },
    });
    await channel.notify({
      recipientId: firstTherapist.id,
      appointmentId: firstAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Mais tarde",
      spokenText: "Mais tarde",
      scheduledFor: new Date("2026-10-21T15:00:00Z"),
    });
    await channel.notify({
      recipientId: firstTherapist.id,
      appointmentId: secondAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Mais cedo",
      spokenText: "Mais cedo",
      scheduledFor: new Date("2026-10-21T14:00:00Z"),
    });
    await channel.notify({
      recipientId: secondTherapist.id,
      appointmentId: firstAppointment.id,
      kind: "CHECK_IN_CONFIRMATION",
      message: "Other",
      spokenText: "Other",
      scheduledFor: new Date("2026-10-21T13:00:00Z"),
    });

    const response = await request(app.getHttpServer())
      .get("/api/notifications")
      .set("x-user-id", firstTherapist.id)
      .expect(200);

    expect(response.body.items.map(({ appointmentId }: { appointmentId: string }) => appointmentId)).toEqual([
      secondAppointment.id,
      firstAppointment.id,
    ]);
    expect(response.body.items.every(({ spokenText }: { spokenText: string }) => spokenText.length > 0)).toBe(true);
    expect(response.body.spokenText).toContain("2 avisos");
  });
});
