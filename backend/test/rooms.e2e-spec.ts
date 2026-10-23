import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_ID = "00000000-0000-4000-8000-000000000001";
const LONDRINA_ID = "00000000-0000-4000-8000-000000000002";
const MISSING_LOCATION_ID = "8b0e2f51-7c1a-4d55-9b0e-2f517c1a4d55";
const MISSING_ROOM_ID = "3f6c1d2e-5a4b-4c3d-8e2f-1a0b9c8d7e6f";
const NOW = new Date("2026-10-21T13:55:00.000Z");
const APPOINTMENT_STARTS_AT = new Date("2026-10-21T14:00:00.000Z");
const APPOINTMENT_ENDS_AT = new Date("2026-10-21T14:20:00.000Z");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Rooms (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;

  const postRoom = (body: Record<string, string>) =>
    request(app.getHttpServer()).post("/api/rooms").set("x-user-id", hrId).send(body);

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
    hrId = (await prisma.user.create({ data: { email: "hr@example.com", name: "Helena Rocha", role: "HR" } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-03.02 RF-24: creates a room with a generated check-in token and an audit event", async () => {
    const response = await postRoom({ name: "Sala 3", locationId: SAO_PAULO_ID }).expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      name: "Sala 3",
      locationId: SAO_PAULO_ID,
      locationCode: "SAO_PAULO",
      active: true,
      checkInToken: expect.stringMatching(UUID_PATTERN),
    });
    const events = await prisma.auditEvent.findMany({ where: { entityId: response.body.id } });
    expect(events).toEqual([expect.objectContaining({ actorId: hrId, action: "ROOM_CREATED", entityType: "Room" })]);
  });

  it("TK-03.02 RF-24: refuses a room name already used in the same location and records nothing", async () => {
    await postRoom({ name: "Sala 3", locationId: SAO_PAULO_ID }).expect(201);

    const response = await postRoom({ name: " Sala 3 ", locationId: SAO_PAULO_ID }).expect(409);

    expect(response.body.message).toBe(messages.errors.roomNameAlreadyExists);
    expect(await prisma.room.count()).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(1);
  });

  it("TK-03.02 RF-24: accepts the same room name in another location", async () => {
    await postRoom({ name: "Sala 3", locationId: SAO_PAULO_ID }).expect(201);

    await postRoom({ name: "Sala 3", locationId: LONDRINA_ID }).expect(201);
  });

  it("TK-03.02 RF-24: lists only the rooms of the requested location, in alphabetical order", async () => {
    await prisma.room.createMany({
      data: [
        { locationId: LONDRINA_ID, name: "Sala Ipê", checkInToken: "token-ipe" },
        { locationId: SAO_PAULO_ID, name: "Sala 1 - Bela Vista", checkInToken: "token-bela-vista" },
        { locationId: LONDRINA_ID, name: "Sala Araucária", checkInToken: "token-araucaria" },
      ],
    });

    const response = await request(app.getHttpServer())
      .get("/api/rooms?locationCode=LONDRINA")
      .set("x-user-id", hrId)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: expect.any(String),
        name: "Sala Araucária",
        locationId: LONDRINA_ID,
        locationCode: "LONDRINA",
        active: true,
        checkInToken: "token-araucaria",
      },
      expect.objectContaining({ name: "Sala Ipê", locationCode: "LONDRINA" }),
    ]);
  });

  it("TK-03.02 RF-24: filters rooms by active state", async () => {
    await prisma.room.createMany({
      data: [
        { locationId: SAO_PAULO_ID, name: "Sala A", checkInToken: "token-a" },
        { locationId: SAO_PAULO_ID, name: "Sala B", checkInToken: "token-b", active: false },
      ],
    });

    const listRooms = (query: string) =>
      request(app.getHttpServer()).get(`/api/rooms?${query}`).set("x-user-id", hrId).expect(200);

    expect((await listRooms("active=false")).body).toEqual([expect.objectContaining({ name: "Sala B" })]);
    expect((await listRooms("active=true")).body).toEqual([expect.objectContaining({ name: "Sala A" })]);
    expect((await listRooms("")).body).toHaveLength(2);
  });

  describe("regenerating the check-in token", () => {
    const regenerateToken = (roomId: string) =>
      request(app.getHttpServer()).post(`/api/rooms/${roomId}/regenerate-token`).set("x-user-id", hrId);

    const checkIn = (token: string, employeeId: string) =>
      request(app.getHttpServer()).post(`/api/booking/check-in/${token}`).set("x-user-id", employeeId);

    async function createConfirmedAppointmentInRoom() {
      const [employee, therapistUser] = await Promise.all([
        prisma.user.create({ data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" } }),
        prisma.user.create({ data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" } }),
      ]);
      const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
      const room = await prisma.room.create({
        data: { locationId: SAO_PAULO_ID, name: "Sala 1", checkInToken: "token-t1" },
      });
      await prisma.appointment.create({
        data: {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: room.id,
          startsAt: APPOINTMENT_STARTS_AT,
          endsAt: APPOINTMENT_ENDS_AT,
          status: "CONFIRMED",
        },
      });
      return { employee, room };
    }

    it("TK-03.02 RF-24: replaces the token so check-in with the old one fails and with the new one works", async () => {
      const { employee, room } = await createConfirmedAppointmentInRoom();

      const response = await regenerateToken(room.id).expect(200);

      expect(response.body).toEqual({
        id: room.id,
        name: "Sala 1",
        checkInToken: expect.stringMatching(UUID_PATTERN),
        updatedAt: NOW.toISOString(),
      });
      const oldTokenResponse = await checkIn("token-t1", employee.id).expect(404);
      expect(oldTokenResponse.body.message).toBe(messages.errors.invalidCheckIn);
      await checkIn(response.body.checkInToken, employee.id).expect(200);
    });

    it("TK-03.02 RF-24 RNF-04: audits the regeneration without the old or the new token", async () => {
      const { room } = await createConfirmedAppointmentInRoom();

      const response = await regenerateToken(room.id).expect(200);

      const events = await prisma.auditEvent.findMany({ where: { entityId: room.id } });
      expect(events).toEqual([
        expect.objectContaining({ actorId: hrId, action: "ROOM_TOKEN_REGENERATED", entityType: "Room" }),
      ]);
      const recorded = JSON.stringify(events);
      expect(recorded).not.toContain("token-t1");
      expect(recorded).not.toContain(response.body.checkInToken);
    });

    it("TK-03.02 RF-24: answers 404 for a room that does not exist and records nothing", async () => {
      const response = await regenerateToken(MISSING_ROOM_ID).expect(404);

      expect(response.body.message).toBe(messages.errors.roomNotFound);
      expect(await prisma.auditEvent.count()).toBe(0);
    });
  });

  it("TK-03.02 RF-24: answers 404 for a location that does not exist", async () => {
    const response = await postRoom({ name: "Sala 3", locationId: MISSING_LOCATION_ID }).expect(404);

    expect(response.body.message).toBe(messages.errors.locationNotFound);
    expect(await prisma.room.count()).toBe(0);
  });
});
