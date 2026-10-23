import { INestApplication } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as request from "supertest";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_LOCATION_ID = "00000000-0000-4000-8000-000000000002";
const WORK_DAY = "2026-10-26";
const NEXT_WORK_DAY = "2026-10-27";
const MISSING_SLOT_ID = "6a1f0c9e-2b3d-4e5f-8a7b-9c0d1e2f3a4b";

const local = (date: string, time: string): string => new Date(`${date}T${time}:00.000-03:00`).toISOString();

type SlotInput = Partial<Record<"therapistId" | "roomId" | "startsAt" | "endsAt", string>>;

describe("Schedules (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let adminId: string;
  let therapistId: string;
  let otherTherapistId: string;
  let roomId: string;
  let secondRoomId: string;
  let otherLocationRoomId: string;

  const createTherapist = async (email: string, name: string) => {
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return prisma.therapist.create({ data: { userId: user.id } });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.createMany({
      data: [
        { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" },
        { id: OTHER_LOCATION_ID, code: "LONDRINA", name: "Londrina" },
      ],
    });
    const [hr, admin] = await Promise.all([
      prisma.user.create({ data: { email: "hr@example.com", name: "Helena RH", role: "HR" } }),
      prisma.user.create({ data: { email: "admin@example.com", name: "Adriana Admin", role: "ADMIN" } }),
    ]);
    const [therapist, otherTherapist] = await Promise.all([
      createTherapist("therapist@example.com", "Tereza Therapist"),
      createTherapist("other-therapist@example.com", "Otto Therapist"),
    ]);
    const [room, secondRoom, otherLocationRoom] = await Promise.all([
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala A", checkInToken: "token-a" } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala B", checkInToken: "token-b" } }),
      prisma.room.create({ data: { locationId: OTHER_LOCATION_ID, name: "Sala C", checkInToken: "token-c" } }),
    ]);
    hrId = hr.id;
    adminId = admin.id;
    therapistId = therapist.id;
    otherTherapistId = otherTherapist.id;
    roomId = room.id;
    secondRoomId = secondRoom.id;
    otherLocationRoomId = otherLocationRoom.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const createSlot = (input: SlotInput = {}, actorId = hrId) =>
    request(app.getHttpServer())
      .post("/api/schedules")
      .set("x-user-id", actorId)
      .send({
        therapistId,
        roomId,
        startsAt: local(WORK_DAY, "09:00"),
        endsAt: local(WORK_DAY, "17:00"),
        ...input,
      });

  const listSlots = (query: Record<string, string>, actorId = hrId) =>
    request(app.getHttpServer()).get("/api/schedules").query(query).set("x-user-id", actorId);

  describe("access", () => {
    it.each<[UserRole, number]>([
      ["EMPLOYEE", 403],
      ["THERAPIST", 403],
    ])("TK-03.03 RF-25: refuses %s", async (role, status) => {
      const user = await prisma.user.create({ data: { email: `${role}@example.com`, name: "Ana Souza", role } });

      const response = await listSlots({}, user.id).expect(status);

      expect(response.body.message).toBe(messages.errors.accessDenied);
    });

    it("TK-03.03 RF-25: refuses a request without identification", async () => {
      const response = await request(app.getHttpServer()).get("/api/schedules").expect(401);

      expect(response.body.message).toBe(messages.errors.notIdentified);
    });

    it("TK-03.03 RF-25: lets ADMIN manage the schedule", async () => {
      await createSlot({}, adminId).expect(201);

      const listed = await listSlots({ date: WORK_DAY }, adminId).expect(200);

      expect(listed.body).toHaveLength(1);
    });
  });

  describe("BDD scenarios", () => {
    it("TK-03.03 RF-25: scenario 1, creates a period without conflict and lists it on its day", async () => {
      const created = await createSlot().expect(201);

      expect(created.body).toEqual({
        id: expect.any(String),
        therapistId,
        roomId,
        startsAt: "2026-10-26T12:00:00.000Z",
        endsAt: "2026-10-26T20:00:00.000Z",
        createdAt: expect.any(String),
      });
      const listed = await listSlots({ date: WORK_DAY }).expect(200);
      expect(listed.body).toEqual([created.body]);
    });

    it("TK-03.03 RN-08: scenario 2, refuses a second period for the same therapist at the same time", async () => {
      await createSlot({ startsAt: local(WORK_DAY, "09:00"), endsAt: local(WORK_DAY, "13:00") }).expect(201);

      const response = await createSlot({
        roomId: secondRoomId,
        startsAt: local(WORK_DAY, "11:00"),
        endsAt: local(WORK_DAY, "15:00"),
      }).expect(409);

      expect(response.body.message).toBe(messages.errors.scheduleConflictTherapist);
      expect(response.body.message).toBe("O massoterapeuta já possui outro período de trabalho neste mesmo horário.");
    });

    it("TK-03.03 RN-08: scenario 3, refuses a room already taken by another therapist", async () => {
      await createSlot({ startsAt: local(WORK_DAY, "09:00"), endsAt: local(WORK_DAY, "14:00") }).expect(201);

      const response = await createSlot({
        therapistId: otherTherapistId,
        startsAt: local(WORK_DAY, "13:00"),
        endsAt: local(WORK_DAY, "18:00"),
      }).expect(409);

      expect(response.body.message).toBe(messages.errors.scheduleConflictRoom);
      expect(response.body.message).toBe("A sala selecionada já está ocupada por outro período neste mesmo horário.");
    });
  });

  describe("validation", () => {
    it("TK-03.03 RF-25: refuses an inactive therapist with the catalog message", async () => {
      const therapist = await prisma.therapist.findUniqueOrThrow({ where: { id: therapistId } });
      await prisma.user.update({ where: { id: therapist.userId }, data: { status: "INACTIVE" } });

      const response = await createSlot().expect(400);

      expect(response.body.message).toBe("O massoterapeuta selecionado está inativo.");
    });

    it("TK-03.03 RF-25: refuses an inactive room with the catalog message", async () => {
      await prisma.room.update({ where: { id: roomId }, data: { active: false } });

      const response = await createSlot().expect(400);

      expect(response.body.message).toBe("A sala selecionada está inativa.");
    });

    it("TK-03.03 RF-25: refuses a period whose end is not after its start", async () => {
      const response = await createSlot({ endsAt: local(WORK_DAY, "09:00") }).expect(400);

      expect(response.body.message).toBe(messages.errors.invalidPeriod);
    });

    it("TK-03.03 RN-08: refuses a period outside the operating hours", async () => {
      const response = await createSlot({ endsAt: local(WORK_DAY, "19:00") }).expect(400);

      expect(response.body.message).toBe(messages.errors.outsideOperatingHours);
    });

    it("TK-03.03 RF-25: refuses a listing without a date or a date interval", async () => {
      const response = await listSlots({ therapistId }).expect(400);

      expect(response.body.message).toBe(messages.errors.invalidPeriod);
    });

    it("TK-03.03 RF-25: refuses a period that crosses midnight in America/Sao_Paulo", async () => {
      const response = await createSlot({
        startsAt: local(WORK_DAY, "17:00"),
        endsAt: local(NEXT_WORK_DAY, "09:00"),
      }).expect(400);

      expect(response.body.message).toBe(messages.errors.invalidPeriod);
    });

    it("TK-03.03 RF-25: refuses a date filter that is not a calendar date", async () => {
      await listSlots({ date: "2026-10-26T09:00:00Z" }).expect(400);
      await listSlots({ date: "2026-02-30" }).expect(400);
    });

    it("TK-03.03 RF-25: answers not found for an unknown period", async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/schedules/${MISSING_SLOT_ID}`)
        .set("x-user-id", hrId)
        .expect(404);

      expect(response.body.message).toBe(messages.errors.scheduleNotFound);
    });
  });

  describe("listing", () => {
    it("TK-03.03 RF-25: filters by therapist, room, location and date interval in chronological order", async () => {
      const nextDay = await createSlot({
        startsAt: local(NEXT_WORK_DAY, "09:00"),
        endsAt: local(NEXT_WORK_DAY, "12:00"),
      }).expect(201);
      const afternoon = await createSlot({
        startsAt: local(WORK_DAY, "13:00"),
        endsAt: local(WORK_DAY, "17:00"),
      }).expect(201);
      const morning = await createSlot({
        startsAt: local(WORK_DAY, "09:00"),
        endsAt: local(WORK_DAY, "12:00"),
      }).expect(201);
      const otherLocation = await createSlot({ therapistId: otherTherapistId, roomId: otherLocationRoomId }).expect(
        201,
      );

      const ids = async (query: Record<string, string>) =>
        (await listSlots(query).expect(200)).body.map((slot: { id: string }) => slot.id);

      expect(await ids({ startDate: WORK_DAY, endDate: NEXT_WORK_DAY, therapistId })).toEqual([
        morning.body.id,
        afternoon.body.id,
        nextDay.body.id,
      ]);
      expect(await ids({ date: WORK_DAY, roomId })).toEqual([morning.body.id, afternoon.body.id]);
      expect(await ids({ date: WORK_DAY, locationCode: "LONDRINA" })).toEqual([otherLocation.body.id]);
      expect(await ids({ date: "2026-10-28" })).toEqual([]);
    });
  });

  describe("lifecycle", () => {
    it("TK-03.03 RF-25: edits and removes a period, recording immutable audit events", async () => {
      const created = await createSlot().expect(201);
      const updated = await request(app.getHttpServer())
        .patch(`/api/schedules/${created.body.id}`)
        .set("x-user-id", hrId)
        .send({ roomId: secondRoomId, startsAt: local(WORK_DAY, "10:00"), endsAt: local(WORK_DAY, "16:00") })
        .expect(200);

      expect(updated.body).toEqual(
        expect.objectContaining({
          id: created.body.id,
          roomId: secondRoomId,
          startsAt: "2026-10-26T13:00:00.000Z",
          endsAt: "2026-10-26T19:00:00.000Z",
        }),
      );
      await request(app.getHttpServer()).delete(`/api/schedules/${created.body.id}`).set("x-user-id", hrId).expect(204);
      expect((await listSlots({ date: WORK_DAY }).expect(200)).body).toEqual([]);

      const events = await prisma.auditEvent.findMany({
        where: { entityType: "ScheduleSlot", entityId: created.body.id },
        orderBy: { createdAt: "asc" },
      });
      expect(events.map(({ actorId, action, data }) => ({ actorId, action, data }))).toEqual([
        {
          actorId: hrId,
          action: "SCHEDULE_SLOT_CREATED",
          data: { therapistId, roomId, startsAt: "2026-10-26T12:00:00.000Z", endsAt: "2026-10-26T20:00:00.000Z" },
        },
        {
          actorId: hrId,
          action: "SCHEDULE_SLOT_UPDATED",
          data: {
            therapistId,
            roomId: secondRoomId,
            startsAt: "2026-10-26T13:00:00.000Z",
            endsAt: "2026-10-26T19:00:00.000Z",
          },
        },
        {
          actorId: hrId,
          action: "SCHEDULE_SLOT_DELETED",
          data: {
            therapistId,
            roomId: secondRoomId,
            startsAt: "2026-10-26T13:00:00.000Z",
            endsAt: "2026-10-26T19:00:00.000Z",
          },
        },
      ]);
    });
  });
});
