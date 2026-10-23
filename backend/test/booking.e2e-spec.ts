import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const MONDAY_9AM_IN_SAO_PAULO = new Date("2026-10-19T12:00:00Z");
const WEDNESDAY_9AM_IN_SAO_PAULO = new Date("2026-10-21T12:00:00Z");
const WEDNESDAY_10AM_IN_SAO_PAULO = new Date("2026-10-21T13:00:00Z");

describe("Legacy booking routes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(MONDAY_9AM_IN_SAO_PAULO) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({
      data: { id: SAO_PAULO_LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const createEmployee = (email: string) =>
    prisma.user.create({ data: { email, name: "Ana Souza", role: "EMPLOYEE" } });

  const createTherapist = async (email: string) => {
    const user = await prisma.user.create({ data: { email, name: "Bruno Lima", role: "THERAPIST" } });
    return prisma.therapist.create({ data: { userId: user.id } });
  };

  const createRoom = (name: string) =>
    prisma.room.create({ data: { locationId: SAO_PAULO_LOCATION_ID, name, checkInToken: `token-${name}` } });

  const createWednesdayMorningSlot = async () => {
    const therapist = await createTherapist("bruno@example.com");
    const room = await createRoom("Sala 1");
    await prisma.scheduleSlot.create({
      data: {
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: WEDNESDAY_9AM_IN_SAO_PAULO,
        endsAt: WEDNESDAY_10AM_IN_SAO_PAULO,
      },
    });
    return { therapist, room };
  };

  it("TK-01.02: reserving a slot returns the appointment with employeeId", async () => {
    const employee = await createEmployee("ana@example.com");
    const { therapist, room } = await createWednesdayMorningSlot();

    const response = await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: "2026-10-21T12:20:00.000Z",
        endsAt: "2026-10-21T12:40:00.000Z",
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: "2026-10-21T12:20:00.000Z",
        endsAt: "2026-10-21T12:40:00.000Z",
        status: "CONFIRMED",
      }),
    );
    expect(response.body).not.toHaveProperty("collaboratorId");
  });

  it("TK-01.03: a reservation made through the legacy route is stored as CONFIRMED", async () => {
    const employee = await createEmployee("ana@example.com");
    const { therapist, room } = await createWednesdayMorningSlot();
    await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: "2026-10-21T12:20:00.000Z",
        endsAt: "2026-10-21T12:40:00.000Z",
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body.upcoming).toEqual([expect.objectContaining({ roomName: room.name, status: "CONFIRMED" })]);
  });

  it("TK-01.02: lists the available slots of a schedule slot", async () => {
    const employee = await createEmployee("ana@example.com");
    const { therapist, room } = await createWednesdayMorningSlot();
    const slot = (startsAt: string, endsAt: string) => ({
      startsAt,
      endsAt,
      therapistId: therapist.id,
      therapistName: "Bruno Lima",
      roomId: room.id,
      roomName: "Sala 1",
      location: { id: SAO_PAULO_LOCATION_ID, code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" },
    });

    const response = await request(app.getHttpServer())
      .get("/api/booking/slots")
      .query({ from: "2026-10-21T12:00:00.000Z", to: "2026-10-21T13:00:00.000Z", durationMinutes: 20 })
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual({
      therapists: [{ id: therapist.id, name: "Bruno Lima" }],
      slots: [
        slot("2026-10-21T12:00:00.000Z", "2026-10-21T12:20:00.000Z"),
        slot("2026-10-21T12:20:00.000Z", "2026-10-21T12:40:00.000Z"),
        slot("2026-10-21T12:40:00.000Z", "2026-10-21T13:00:00.000Z"),
      ],
    });
  });

  it("TK-01.02: lists each therapist's availability under scheduleSlots", async () => {
    const employee = await createEmployee("ana@example.com");
    const { therapist, room } = await createWednesdayMorningSlot();

    const response = await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({ from: "2026-10-21T00:00:00.000Z", to: "2026-10-22T00:00:00.000Z" })
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: therapist.id,
        user: { name: "Bruno Lima" },
        scheduleSlots: [
          expect.objectContaining({
            therapistId: therapist.id,
            roomId: room.id,
            startsAt: "2026-10-21T12:00:00.000Z",
            endsAt: "2026-10-21T13:00:00.000Z",
          }),
        ],
        blocks: [],
        appointments: [],
      }),
    ]);
    expect(response.body[0]).not.toHaveProperty("windows");
  });

  it("TK-01.02: the database rejects a schedule slot that ends before it starts", async () => {
    const therapist = await createTherapist("bruno@example.com");
    const room = await createRoom("Sala 1");

    const inverted = prisma.scheduleSlot.create({
      data: {
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: WEDNESDAY_10AM_IN_SAO_PAULO,
        endsAt: WEDNESDAY_9AM_IN_SAO_PAULO,
      },
    });

    await expect(inverted).rejects.toThrow(/schedule_slots_period_check/);
  });
});
