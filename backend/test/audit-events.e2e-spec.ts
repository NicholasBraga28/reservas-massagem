import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_TIME = new Date("2026-10-21T14:00:00.000Z");
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000011";
const SECOND_APPOINTMENT_ID = "00000000-0000-4000-8000-000000000012";
const EVENT_IDS = [
  "00000000-0000-4000-8000-000000000021",
  "00000000-0000-4000-8000-000000000022",
  "00000000-0000-4000-8000-000000000023",
  "00000000-0000-4000-8000-000000000024",
];

describe("Audit event queries (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let employeeId: string;
  let secondAppointmentId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
    const [hr, employee, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "hr-audit@example.com", name: "Rita RH", role: "HR" } }),
      prisma.user.create({ data: { email: "employee-audit@example.com", name: "Caio Employee", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist-audit@example.com", name: "Eva Therapist", role: "THERAPIST" } }),
    ]);
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala A", checkInToken: "audit-events-room-token" },
    });
    await prisma.appointment.createMany({
      data: [
        {
          id: APPOINTMENT_ID,
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: room.id,
          startsAt: EVENT_TIME,
          endsAt: new Date("2026-10-21T14:20:00.000Z"),
          status: "CANCELLED",
        },
        {
          id: SECOND_APPOINTMENT_ID,
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: room.id,
          startsAt: new Date("2026-10-21T15:00:00.000Z"),
          endsAt: new Date("2026-10-21T15:20:00.000Z"),
          status: "CONFIRMED",
        },
      ],
    });
    await prisma.auditEvent.createMany({
      data: [
        {
          id: EVENT_IDS[0],
          actorId: hr.id,
          action: "APPOINTMENT_CREATED",
          entityType: "Appointment",
          entityId: APPOINTMENT_ID,
          createdAt: EVENT_TIME,
          data: { status: "CONFIRMED", employeeName: "Caio Employee", email: employee.email, healthData: "private" },
        },
        {
          id: EVENT_IDS[1],
          actorId: null,
          action: "APPOINTMENT_CANCELLED",
          entityType: "Appointment",
          entityId: APPOINTMENT_ID,
          createdAt: EVENT_TIME,
          data: { status: "CANCELLED", internalPayload: "must not be returned" },
        },
        {
          id: EVENT_IDS[2],
          actorId: therapistUser.id,
          action: "SESSION_STARTED",
          entityType: "Appointment",
          entityId: APPOINTMENT_ID,
          createdAt: new Date("2026-10-21T13:59:00.000Z"),
          data: { unknownField: "must not be returned" },
        },
        {
          id: EVENT_IDS[3],
          actorId: hr.id,
          action: "APPOINTMENT_CREATED",
          entityType: "Appointment",
          entityId: SECOND_APPOINTMENT_ID,
          createdAt: new Date("2026-10-21T14:01:00.000Z"),
          data: { status: "CONFIRMED" },
        },
        {
          action: "USER_UPDATED",
          actorId: hr.id,
          entityType: "User",
          entityId: employee.id,
          createdAt: EVENT_TIME,
          data: { email: employee.email },
        },
      ],
    });
    hrId = hr.id;
    employeeId = employee.id;
    secondAppointmentId = SECOND_APPOINTMENT_ID;
  });

  afterAll(async () => {
    await app.close();
  });

  const getEvents = (userId: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get("/api/audit-events").query(query).set("x-user-id", userId);

  it("TK-08.03 RF-22 RNF-04: returns appointment audit events with safe data and localized spoken text", async () => {
    const response = await getEvents(hrId).expect(200);

    expect(response.body.items).toHaveLength(4);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        id: EVENT_IDS[3],
        actorId: hrId,
        action: "APPOINTMENT_CREATED",
        entityType: "Appointment",
        entityId: secondAppointmentId,
        createdAt: "2026-10-21T14:01:00.000Z",
        data: { status: "CONFIRMED" },
      }),
    );
    expect(response.body.items[1]).toEqual(
      expect.objectContaining({ id: EVENT_IDS[1], actorId: null, data: { status: "CANCELLED" } }),
    );
    expect(response.body.items[1].spokenText).toContain("Evento do sistema");
    expect(response.body.items[2]).toEqual(
      expect.objectContaining({ id: EVENT_IDS[0], data: { status: "CONFIRMED" } }),
    );
    expect(response.body.items[2].spokenText).toContain("21 de outubro às 11h");
    expect(response.body.items[3].data).toEqual({});
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      EVENT_IDS[3],
      EVENT_IDS[1],
      EVENT_IDS[0],
      EVENT_IDS[2],
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /Caio Employee|employee-audit@example\.com|private|internalPayload|unknownField/,
    );
    expect(response.body.spokenText).toBe("4 eventos de auditoria no período consultado.");
    expect(response.body.nextCursor).toBeNull();
  });

  it("TK-08.03 RF-22: applies inclusive from, exclusive to, appointment, actor, and exact action filters", async () => {
    const response = await getEvents(hrId, {
      from: "2026-10-21T14:00:00.000Z",
      to: "2026-10-21T14:01:00.000Z",
      appointmentId: APPOINTMENT_ID,
      actorId: hrId,
      action: "APPOINTMENT_CREATED",
    }).expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(EVENT_IDS[0]);
    expect(response.body.spokenText).toBe("1 evento de auditoria no período consultado.");
  });

  it("TK-08.03 RF-22: paginates in stable descending order without duplicate events", async () => {
    const firstPage = await getEvents(hrId, { limit: "2" }).expect(200);
    expect(firstPage.body.items.map((item: { id: string }) => item.id)).toEqual([EVENT_IDS[3], EVENT_IDS[1]]);
    expect(firstPage.body.nextCursor).toBe(EVENT_IDS[1]);

    const secondPage = await getEvents(hrId, { limit: "2", cursor: firstPage.body.nextCursor }).expect(200);
    expect(secondPage.body.items.map((item: { id: string }) => item.id)).toEqual([EVENT_IDS[0], EVENT_IDS[2]]);
    expect(secondPage.body.nextCursor).toBeNull();
    expect(
      new Set([...firstPage.body.items, ...secondPage.body.items].map((item: { id: string }) => item.id)).size,
    ).toBe(4);
  });

  it("TK-08.03 RF-22: rejects invalid filters and cursor values with catalog messages", async () => {
    const invalidDate = await getEvents(hrId, { from: "not-a-date" }).expect(400);
    expect(invalidDate.body.message).toBe("O período do relatório é inválido. Confira as datas e tente novamente.");

    const reversedDateRange = await getEvents(hrId, {
      from: "2026-10-22T14:00:00.000Z",
      to: "2026-10-21T14:00:00.000Z",
    }).expect(400);
    expect(reversedDateRange.body.message).toBe(
      "O período do relatório é inválido. Confira as datas e tente novamente.",
    );

    const invalidCursor = await getEvents(hrId, { cursor: "not-a-uuid" }).expect(400);
    expect(invalidCursor.body.message).toBe(
      "Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente.",
    );

    const missingCursor = await getEvents(hrId, { cursor: "00000000-0000-4000-8000-000000000099" }).expect(400);
    expect(missingCursor.body.message).toBe(
      "Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente.",
    );
  });

  it("TK-08.03 RF-22: requires HR or ADMIN authorization", async () => {
    await request(app.getHttpServer()).get("/api/audit-events").expect(401);
    await getEvents(employeeId).expect(403);
    await getEvents(hrId).expect(200);
  });
});
