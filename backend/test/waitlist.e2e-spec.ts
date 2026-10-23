import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { WaitlistService } from "../src/waitlist/waitlist.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");
const STARTS_AT = "2026-10-21T14:00:00.000Z";
const ENDS_AT = "2026-10-21T14:20:00.000Z";

describe("Waitlist (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;

  beforeAll(async () => {
    clock = new FakeClock(NOW);
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createEmployee(email: string, name: string) {
    return prisma.user.create({ data: { email, name, role: "EMPLOYEE" } });
  }

  async function createSchedule() {
    const therapistUser = await prisma.user.create({
      data: { email: `therapist-${Date.now()}@example.com`, name: "Ana Souza", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: `token-${Date.now()}` },
    });
    await prisma.scheduleSlot.create({
      data: {
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T13:00:00Z"),
        endsAt: new Date("2026-10-21T15:00:00Z"),
      },
    });
    return { therapist, room };
  }

  async function createOccupiedAppointment(employeeId: string, therapistId: string, roomId: string) {
    return prisma.appointment.create({
      data: {
        employeeId,
        therapistId,
        roomId,
        startsAt: new Date(STARTS_AT),
        endsAt: new Date(ENDS_AT),
        status: "CONFIRMED",
      },
    });
  }

  it("RF-04 RN-10: joins and leaves the waitlist in entry order", async () => {
    const firstEmployee = await createEmployee("first@example.com", "First Employee");
    const secondEmployee = await createEmployee("second@example.com", "Second Employee");
    const { therapist, room } = await createSchedule();
    await createOccupiedAppointment(firstEmployee.id, therapist.id, room.id);

    const first = await request(app.getHttpServer())
      .post("/api/booking/waitlist")
      .set("x-user-id", firstEmployee.id)
      .send({ therapistId: therapist.id, desiredStartsAt: STARTS_AT, desiredEndsAt: ENDS_AT })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/api/booking/waitlist")
      .set("x-user-id", secondEmployee.id)
      .send({ therapistId: therapist.id, desiredStartsAt: STARTS_AT, desiredEndsAt: ENDS_AT })
      .expect(201);

    expect(first.body.status).toBe("WAITING");
    expect(second.body.status).toBe("WAITING");
    await request(app.getHttpServer())
      .delete(`/api/booking/waitlist/${first.body.id}`)
      .set("x-user-id", firstEmployee.id)
      .expect(204);
    expect((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: first.body.id } })).status).toBe("CANCELLED");
  });

  it("RF-04 RN-10: offers the released appointment to the first compatible candidate with a spoken card", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    const { therapist, room } = await createSchedule();
    const appointment = await createOccupiedAppointment(employee.id, therapist.id, room.id);
    const entry = await prisma.waitlistEntry.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        desiredStartsAt: new Date(STARTS_AT),
        desiredEndsAt: new Date(ENDS_AT),
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", employee.id)
      .expect(200);

    const offered = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(offered.status).toBe("NOTIFIED");
    expect(offered.offerExpiresAt).not.toBeNull();
    expect(
      await prisma.notification.findFirst({ where: { recipientId: employee.id, kind: "WAITLIST_VACANCY" } }),
    ).not.toBeNull();
  });

  it("RF-04 RN-10: accepts a valid offer and creates one confirmed appointment", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    const { therapist } = await createSchedule();
    const entry = await prisma.waitlistEntry.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        desiredStartsAt: new Date(STARTS_AT),
        desiredEndsAt: new Date(ENDS_AT),
        status: "NOTIFIED",
        offeredAt: NOW,
        offerExpiresAt: new Date("2026-10-19T12:30:00Z"),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/booking/waitlist/${entry.id}/accept`)
      .set("x-user-id", employee.id)
      .expect(201);

    expect(response.body.status).toBe("CONFIRMED");
    expect((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe("CONVERTED");
  });

  it("RF-04 RN-10: expires an offer idempotently and advances to the next candidate", async () => {
    const firstEmployee = await createEmployee("first@example.com", "First Employee");
    const secondEmployee = await createEmployee("second@example.com", "Second Employee");
    const { therapist } = await createSchedule();
    const expired = await prisma.waitlistEntry.create({
      data: {
        employeeId: firstEmployee.id,
        therapistId: therapist.id,
        desiredStartsAt: new Date(STARTS_AT),
        desiredEndsAt: new Date(ENDS_AT),
        status: "NOTIFIED",
        offeredAt: NOW,
        offerExpiresAt: new Date("2026-10-19T12:30:00Z"),
      },
    });
    const next = await prisma.waitlistEntry.create({
      data: {
        employeeId: secondEmployee.id,
        therapistId: therapist.id,
        desiredStartsAt: new Date(STARTS_AT),
        desiredEndsAt: new Date(ENDS_AT),
      },
    });
    clock.advanceMinutes(31);

    const waitlist = app.get(WaitlistService);
    await waitlist.expireOffers();
    await waitlist.expireOffers();

    expect((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe("EXPIRED");
    expect((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: next.id } })).status).toBe("NOTIFIED");
  });
});
