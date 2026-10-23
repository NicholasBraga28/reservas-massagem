import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { seedDemoData } from "../prisma/demo-seed";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";
const WORK_START_MINUTES = 9 * 60;
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_END_MINUTES = 13 * 60;
const WORK_END_MINUTES = 18 * 60;

function minutesSinceMidnightInSaoPaulo(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour * 60 + minute;
}

function weekdayInSaoPaulo(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: SAO_PAULO_TIMEZONE, weekday: "short" }).format(date);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday]!;
}

describe("Demo seed (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-01.07: creates two units, rooms, therapists, employees, HR and ADMIN", async () => {
    await seedDemoData(prisma);

    const locations = await prisma.location.findMany({ include: { rooms: true } });
    const therapists = await prisma.therapist.findMany({ include: { user: true } });
    const employees = await prisma.user.findMany({ where: { role: "EMPLOYEE" } });
    const hrUsers = await prisma.user.findMany({ where: { role: "HR" } });
    const adminUsers = await prisma.user.findMany({ where: { role: "ADMIN" } });

    expect(locations).toHaveLength(2);
    for (const location of locations) {
      expect(location.rooms.length).toBeGreaterThanOrEqual(2);
    }
    expect(therapists.length).toBeGreaterThanOrEqual(2);
    expect(new Set(therapists.map((t) => t.user.name)).size).toBe(therapists.length);
    expect(employees.length).toBeGreaterThanOrEqual(3);
    expect(hrUsers).toHaveLength(1);
    expect(adminUsers).toHaveLength(1);
  });

  it("RN-08: never generates a period outside business hours, lunch or a non-work day", async () => {
    await seedDemoData(prisma);

    const slots = await prisma.scheduleSlot.findMany();
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect([1, 2, 3, 4, 5]).toContain(weekdayInSaoPaulo(slot.startsAt));
      expect(minutesSinceMidnightInSaoPaulo(slot.startsAt)).toBeGreaterThanOrEqual(WORK_START_MINUTES);
      expect(minutesSinceMidnightInSaoPaulo(slot.endsAt)).toBeLessThanOrEqual(WORK_END_MINUTES);
      const startsBeforeLunch = minutesSinceMidnightInSaoPaulo(slot.endsAt) <= LUNCH_START_MINUTES;
      const startsAfterLunch = minutesSinceMidnightInSaoPaulo(slot.startsAt) >= LUNCH_END_MINUTES;
      expect(startsBeforeLunch || startsAfterLunch).toBe(true);
    }
  });

  it("TK-01.07: running the seed twice does not change user, room or schedule counts", async () => {
    await seedDemoData(prisma);
    const usersAfterFirstRun = await prisma.user.count();
    const roomsAfterFirstRun = await prisma.room.count();
    const slotsAfterFirstRun = await prisma.scheduleSlot.count();

    await seedDemoData(prisma);

    expect(await prisma.user.count()).toBe(usersAfterFirstRun);
    expect(await prisma.room.count()).toBe(roomsAfterFirstRun);
    expect(await prisma.scheduleSlot.count()).toBe(slotsAfterFirstRun);
  });

  it("TK-01.07: a future appointment and its schedule slot survive a second run of the seed", async () => {
    await seedDemoData(prisma);
    const therapist = await prisma.therapist.findFirstOrThrow();
    const employee = await prisma.user.findFirstOrThrow({ where: { role: "EMPLOYEE" } });
    const futureSlot = await prisma.scheduleSlot.findFirstOrThrow({
      where: { therapistId: therapist.id, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: futureSlot.roomId,
        startsAt: futureSlot.startsAt,
        endsAt: new Date(futureSlot.startsAt.getTime() + 20 * 60_000),
        status: "CONFIRMED",
      },
    });

    await seedDemoData(prisma);

    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toBeDefined();
    await expect(prisma.scheduleSlot.findUniqueOrThrow({ where: { id: futureSlot.id } })).resolves.toBeDefined();
  });

  it("TK-01.07: the legacy available-slots route returns slots from two or more therapists", async () => {
    await seedDemoData(prisma);
    const employee = await prisma.user.findFirstOrThrow({ where: { role: "EMPLOYEE" } });
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 21 * 24 * 60 * 60_000).toISOString();

    const response = await request(app.getHttpServer())
      .get("/api/booking/slots")
      .query({ from, to, durationMinutes: 20 })
      .set("x-user-id", employee.id)
      .expect(200);

    const therapistIds = new Set(response.body.slots.map((slot: { therapistId: string }) => slot.therapistId));
    expect(therapistIds.size).toBeGreaterThanOrEqual(2);
  });
});
