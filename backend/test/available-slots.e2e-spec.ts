import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_ID = "00000000-0000-4000-8000-000000000001";
const LONDRINA_ID = "00000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-19T11:00:00.000Z");
const WEDNESDAY_START = new Date("2026-10-21T12:00:00.000Z");
const WEDNESDAY_END = new Date("2026-10-21T14:00:00.000Z");

describe("Available slots (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeId: string;
  let therapistId: string;
  let secondTherapistId: string;
  let roomId: string;
  let londrinaRoomId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(NOW) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.createMany({
      data: [
        { id: SAO_PAULO_ID, code: "SAO_PAULO", name: "São Paulo" },
        { id: LONDRINA_ID, code: "LONDRINA", name: "Londrina" },
      ],
    });
    const [employee, therapistUser, secondTherapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "employee@example.com", name: "Eduardo Employee", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" } }),
      prisma.user.create({ data: { email: "therapist-2@example.com", name: "Bruno Lima", role: "THERAPIST" } }),
    ]);
    const [therapist, secondTherapist] = await Promise.all([
      prisma.therapist.create({ data: { userId: therapistUser.id } }),
      prisma.therapist.create({ data: { userId: secondTherapistUser.id } }),
    ]);
    const [room, londrinaRoom] = await Promise.all([
      prisma.room.create({ data: { locationId: SAO_PAULO_ID, name: "Sala A", checkInToken: "token-sao-paulo" } }),
      prisma.room.create({ data: { locationId: LONDRINA_ID, name: "Sala L", checkInToken: "token-londrina" } }),
    ]);
    await prisma.scheduleSlot.createMany({
      data: [
        { therapistId: therapist.id, roomId: room.id, startsAt: WEDNESDAY_START, endsAt: WEDNESDAY_END },
        { therapistId: secondTherapist.id, roomId: londrinaRoom.id, startsAt: WEDNESDAY_START, endsAt: WEDNESDAY_END },
      ],
    });
    await prisma.scheduleBlock.create({
      data: {
        therapistId: therapist.id,
        startsAt: new Date("2026-10-21T12:20:00.000Z"),
        endsAt: new Date("2026-10-21T12:40:00.000Z"),
        createdById: employee.id,
      },
    });
    await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T13:00:00.000Z"),
        endsAt: new Date("2026-10-21T13:20:00.000Z"),
        status: "CONFIRMED",
      },
    });
    employeeId = employee.id;
    therapistId = therapist.id;
    secondTherapistId = secondTherapist.id;
    roomId = room.id;
    londrinaRoomId = londrinaRoom.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("RF-01 RN-05 RN-07 RN-08 RN-12: returns free slots in chronological order with filters and spokenText", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({
        from: WEDNESDAY_START.toISOString(),
        to: WEDNESDAY_END.toISOString(),
        durationMinutes: 20,
        locationCode: "SAO_PAULO",
        therapistId,
      })
      .set("x-user-id", employeeId)
      .expect(200);

    expect(response.body.slots).toEqual([
      expect.objectContaining({
        therapistId,
        roomId,
        startsAt: "2026-10-21T12:00:00.000Z",
        endsAt: "2026-10-21T12:20:00.000Z",
      }),
      expect.objectContaining({
        therapistId,
        roomId,
        startsAt: "2026-10-21T12:40:00.000Z",
        endsAt: "2026-10-21T13:00:00.000Z",
      }),
      expect.objectContaining({
        therapistId,
        roomId,
        startsAt: "2026-10-21T13:20:00.000Z",
        endsAt: "2026-10-21T13:40:00.000Z",
      }),
      expect.objectContaining({
        therapistId,
        roomId,
        startsAt: "2026-10-21T13:40:00.000Z",
        endsAt: "2026-10-21T14:00:00.000Z",
      }),
    ]);
    expect(response.body.slots).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ roomId: londrinaRoomId })]),
    );
    expect(response.body.spokenText).toBe("Há 4 horários disponíveis. Primeiro: Ana, às 9h.");
  });

  it("RF-01: filters availability by location without a therapist filter", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({
        from: WEDNESDAY_START.toISOString(),
        to: WEDNESDAY_END.toISOString(),
        durationMinutes: 20,
        locationCode: "LONDRINA",
      })
      .set("x-user-id", employeeId)
      .expect(200);

    expect(new Set(response.body.slots.map((slot: { therapistId: string }) => slot.therapistId))).toEqual(
      new Set([secondTherapistId]),
    );
  });

  it("RF-01: protects availability with employee identification", async () => {
    await request(app.getHttpServer()).get("/api/booking/availability").expect(401);
    await request(app.getHttpServer())
      .get("/api/booking/availability")
      .query({ from: WEDNESDAY_START.toISOString(), to: WEDNESDAY_END.toISOString(), durationMinutes: 20 })
      .set("x-user-id", employeeId)
      .expect(200);
  });
});
