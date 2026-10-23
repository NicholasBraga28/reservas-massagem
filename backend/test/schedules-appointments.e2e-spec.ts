import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const WORK_DAY = "2026-10-26";
const NOW = new Date("2026-10-24T12:00:00.000Z");
const RACE_ROUNDS = 5;

const local = (time: string): Date => new Date(`${WORK_DAY}T${time}:00.000-03:00`);

describe("Schedules with appointments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let employee: { id: string; name: string };
  let therapistId: string;
  let roomId: string;
  let secondRoomId: string;
  let slotId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(NOW) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const [hr, employeeUser, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "hr@example.com", name: "Helena RH", role: "HR" } }),
      prisma.user.create({ data: { email: "employee@example.com", name: "Eduardo Colaborador", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Tereza Therapist", role: "THERAPIST" } }),
    ]);
    const [therapist, room, secondRoom] = await Promise.all([
      prisma.therapist.create({ data: { userId: therapistUser.id } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala A", checkInToken: "token-a" } }),
      prisma.room.create({ data: { locationId: LOCATION_ID, name: "Sala B", checkInToken: "token-b" } }),
    ]);
    hrId = hr.id;
    employee = { id: employeeUser.id, name: employeeUser.name };
    therapistId = therapist.id;
    roomId = room.id;
    secondRoomId = secondRoom.id;
    const slot = await prisma.scheduleSlot.create({
      data: { therapistId, roomId, startsAt: local("09:00"), endsAt: local("12:00") },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const book = (startsAt: string, status: AppointmentStatus = "CONFIRMED") =>
    prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId,
        roomId,
        startsAt: local(startsAt),
        endsAt: new Date(local(startsAt).getTime() + 30 * 60_000),
        status,
      },
    });

  const updateSlot = (input: Record<string, string>) =>
    request(app.getHttpServer()).patch(`/api/schedules/${slotId}`).set("x-user-id", hrId).send(input);

  const shortenTo = (startsAt: string, endsAt: string) =>
    updateSlot({ startsAt: local(startsAt).toISOString(), endsAt: local(endsAt).toISOString() });

  const removeSlot = () => request(app.getHttpServer()).delete(`/api/schedules/${slotId}`).set("x-user-id", hrId);

  const listedSlotIds = async (): Promise<string[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/schedules")
      .query({ date: WORK_DAY })
      .set("x-user-id", hrId)
      .expect(200);
    return response.body.map((slot: { id: string }) => slot.id);
  };

  const auditedActions = async (): Promise<string[]> => {
    const events = await prisma.auditEvent.findMany({ where: { entityId: slotId }, orderBy: { createdAt: "asc" } });
    return events.map((event) => event.action);
  };

  it("TK-03.04 RF-25: refuses to remove a period with a confirmed appointment and lists it", async () => {
    const appointment = await book("11:00");

    const response = await removeSlot().expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: "Conflict",
      message: messages.errors.scheduleHasAppointments,
      appointments: [
        {
          id: appointment.id,
          startsAt: local("11:00").toISOString(),
          endsAt: local("11:30").toISOString(),
          employee,
        },
      ],
    });
    expect(await listedSlotIds()).toEqual([slotId]);
    expect(await auditedActions()).toEqual([]);
  });

  it("TK-03.04 RF-25: removes a period whose appointments were all cancelled or released", async () => {
    await book("09:00", "CANCELLED");
    await book("10:00", "RELEASED");

    await removeSlot().expect(204);

    expect(await listedSlotIds()).toEqual([]);
    expect(await auditedActions()).toEqual(["SCHEDULE_SLOT_DELETED"]);
  });

  it("TK-03.04 RF-25: refuses to shorten a period past an appointment and accepts a cut that keeps it", async () => {
    const appointment = await book("11:00");

    const refused = await shortenTo("09:00", "11:00").expect(409);

    expect(refused.body.message).toBe(messages.errors.scheduleHasAppointments);
    expect(refused.body.appointments.map((affected: { id: string }) => affected.id)).toEqual([appointment.id]);
    expect(await auditedActions()).toEqual([]);

    const accepted = await shortenTo("10:00", "12:00").expect(200);

    expect(accepted.body.startsAt).toBe(local("10:00").toISOString());
    expect(await auditedActions()).toEqual(["SCHEDULE_SLOT_UPDATED"]);
  });

  it("TK-03.04 RF-25: refuses to move a period with an active appointment to another room", async () => {
    await book("10:00");

    const response = await updateSlot({ roomId: secondRoomId }).expect(409);

    expect(response.body.message).toBe(messages.errors.scheduleHasAppointments);
    expect(await auditedActions()).toEqual([]);
  });

  it("TK-03.04 RF-25: lists every affected appointment in chronological order", async () => {
    const late = await book("11:00", "BOOKED");
    const early = await book("09:00", "CHECKED_IN");
    const middle = await book("10:00", "IN_PROGRESS");

    const response = await removeSlot().expect(409);

    expect(response.body.appointments.map((affected: { id: string }) => affected.id)).toEqual([
      early.id,
      middle.id,
      late.id,
    ]);
  });

  it.each<[AppointmentStatus, number]>([
    ["BOOKED", 409],
    ["CONFIRMED", 409],
    ["CHECKED_IN", 409],
    ["POSSIBLE_NO_SHOW", 409],
    ["IN_PROGRESS", 409],
    ["CANCELLED", 204],
    ["RELEASED", 204],
  ])("TK-03.04 RF-25: removing a period with a %s appointment answers %i", async (status, expected) => {
    await book("10:00", status);

    await removeSlot().expect(expected);
  });

  it("TK-03.04 RF-25: never lets a reservation and the removal of its period both succeed", async () => {
    const reserve = () =>
      request(app.getHttpServer())
        .post("/api/booking/appointments")
        .set("x-user-id", employee.id)
        .send({
          therapistId,
          roomId,
          startsAt: local("10:00").toISOString(),
          endsAt: local("10:20").toISOString(),
        });

    for (let round = 0; round < RACE_ROUNDS; round++) {
      await prisma.appointment.deleteMany();
      await prisma.scheduleSlot.deleteMany();
      slotId = (
        await prisma.scheduleSlot.create({
          data: { therapistId, roomId, startsAt: local("09:00"), endsAt: local("12:00") },
        })
      ).id;

      const [reserved, removed] = await Promise.all([reserve(), removeSlot()]);

      const reservationWon = reserved.status === 201;
      const removalWon = removed.status === 204;
      expect({ reservationWon, removalWon }).not.toEqual({ reservationWon: true, removalWon: true });
      expect(reservationWon || removalWon).toBe(true);
    }
  });
});
