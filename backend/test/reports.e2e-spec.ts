import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_ID = "00000000-0000-4000-8000-000000000001";
const LONDRINA_ID = "00000000-0000-4000-8000-000000000002";
const REPORT_RANGE = { from: "2026-10-19", to: "2026-10-25" };

describe("Reports KPIs (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let adminId: string;
  let employeeId: string;
  let secondTherapistId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.createMany({
      data: [
        { id: SAO_PAULO_ID, code: "SAO_PAULO", name: "São Paulo" },
        { id: LONDRINA_ID, code: "LONDRINA", name: "Londrina" },
      ],
    });
    const [hr, admin, employee, therapistUser, secondTherapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "hr@example.com", name: "Rita RH", role: "HR" } }),
      prisma.user.create({ data: { email: "admin@example.com", name: "Ana Admin", role: "ADMIN" } }),
      prisma.user.create({ data: { email: "employee@example.com", name: "Caio Employee", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Eva Therapist", role: "THERAPIST" } }),
      prisma.user.create({ data: { email: "therapist-two@example.com", name: "Ivo Therapist", role: "THERAPIST" } }),
    ]);
    const [therapist, secondTherapist] = await Promise.all([
      prisma.therapist.create({ data: { userId: therapistUser.id } }),
      prisma.therapist.create({ data: { userId: secondTherapistUser.id } }),
    ]);
    const [saoPauloRoom, londrinaRoom] = await Promise.all([
      prisma.room.create({
        data: { locationId: SAO_PAULO_ID, name: "Sala A", checkInToken: "reports-sao-paulo-token" },
      }),
      prisma.room.create({
        data: { locationId: LONDRINA_ID, name: "Sala L", checkInToken: "reports-londrina-token" },
      }),
    ]);
    await prisma.appointment.createMany({
      data: [
        {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: saoPauloRoom.id,
          startsAt: new Date("2026-10-19T12:00:00.000Z"),
          endsAt: new Date("2026-10-19T12:20:00.000Z"),
          status: "CONFIRMED",
        },
        {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: saoPauloRoom.id,
          startsAt: new Date("2026-10-19T16:00:00.000Z"),
          endsAt: new Date("2026-10-19T16:20:00.000Z"),
          status: "CANCELLED",
          cancelledAt: new Date("2026-10-18T15:00:00.000Z"),
          cancelledById: employee.id,
        },
        {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: saoPauloRoom.id,
          startsAt: new Date("2026-10-20T17:00:00.000Z"),
          endsAt: new Date("2026-10-20T17:20:00.000Z"),
          status: "CONFIRMED",
        },
        {
          employeeId: employee.id,
          therapistId: therapist.id,
          roomId: saoPauloRoom.id,
          startsAt: new Date("2026-10-22T12:20:00.000Z"),
          endsAt: new Date("2026-10-22T12:40:00.000Z"),
          status: "CONFIRMED",
        },
        {
          employeeId: employee.id,
          therapistId: secondTherapist.id,
          roomId: londrinaRoom.id,
          startsAt: new Date("2026-10-22T12:00:00.000Z"),
          endsAt: new Date("2026-10-22T12:20:00.000Z"),
          status: "CONFIRMED",
        },
        {
          employeeId: employee.id,
          therapistId: secondTherapist.id,
          roomId: londrinaRoom.id,
          startsAt: new Date("2026-10-22T17:00:00.000Z"),
          endsAt: new Date("2026-10-22T17:20:00.000Z"),
          status: "CONFIRMED",
        },
      ],
    });
    hrId = hr.id;
    adminId = admin.id;
    employeeId = employee.id;
    secondTherapistId = secondTherapist.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const getKpis = (userId: string, query: Record<string, string> = REPORT_RANGE) =>
    request(app.getHttpServer()).get("/api/reports/kpis").query(query).set("x-user-id", userId);

  it("TK-08.02 RF-21 RNF-01 RNF-05: aggregates demand and cancellation KPIs in local dates", async () => {
    const response = await getKpis(hrId).expect(200);

    expect(response.body.range).toEqual({
      ...REPORT_RANGE,
      granularity: "DAY",
      timezone: "America/Sao_Paulo",
    });
    expect(response.body.demand.byShift).toEqual([
      { shift: "MORNING", appointmentCount: 3 },
      { shift: "AFTERNOON", appointmentCount: 3 },
    ]);
    expect(response.body.demand.mostRequestedShift).toBe("MORNING");
    expect(response.body.demand.byWeekday).toEqual([
      { weekday: "MONDAY", appointmentCount: 2 },
      { weekday: "TUESDAY", appointmentCount: 1 },
      { weekday: "WEDNESDAY", appointmentCount: 0 },
      { weekday: "THURSDAY", appointmentCount: 3 },
      { weekday: "FRIDAY", appointmentCount: 0 },
      { weekday: "SATURDAY", appointmentCount: 0 },
      { weekday: "SUNDAY", appointmentCount: 0 },
    ]);
    expect(response.body.demand.mostRequestedWeekday).toBe("THURSDAY");
    expect(response.body.demand.byStartTime).toHaveLength(24);
    expect(response.body.demand.byStartTime).toEqual(
      expect.arrayContaining([
        { time: "09:00", appointmentCount: 2 },
        { time: "09:20", appointmentCount: 1 },
        { time: "14:00", appointmentCount: 2 },
        { time: "17:40", appointmentCount: 0 },
      ]),
    );
    expect(response.body.demand.mostRequestedStartTime).toBe("09:00");
    expect(response.body.cancellations).toHaveLength(7);
    expect(response.body.cancellations[0]).toEqual({
      periodStart: "2026-10-19",
      periodEnd: "2026-10-19",
      scheduledAppointmentCount: 2,
      cancelledAppointmentCount: 1,
      cancellationRatePercent: 50,
    });
    expect(response.body.cancellations[3]).toEqual({
      periodStart: "2026-10-22",
      periodEnd: "2026-10-22",
      scheduledAppointmentCount: 3,
      cancelledAppointmentCount: 0,
      cancellationRatePercent: 0,
    });
    expect(response.body.spokenText).toContain("Turno mais procurado: manhã");
    expect(response.body.spokenText).toContain("quinta-feira");
    expect(response.body.spokenText).toContain("Cancelamentos: 1 de 6 agendamentos");
    expect(response.body.spokenText).not.toContain("Caio");
  });

  it("TK-08.02 RF-21: filters KPIs by location and therapist together", async () => {
    const response = await getKpis(hrId, {
      ...REPORT_RANGE,
      locationId: LONDRINA_ID,
      therapistId: secondTherapistId,
    }).expect(200);

    expect(response.body.filters).toEqual({ locationId: LONDRINA_ID, therapistId: secondTherapistId });
    expect(response.body.demand.byShift).toEqual([
      { shift: "MORNING", appointmentCount: 1 },
      { shift: "AFTERNOON", appointmentCount: 1 },
    ]);
    expect(
      response.body.cancellations.reduce(
        (count: number, period: { scheduledAppointmentCount: number }) => count + period.scheduledAppointmentCount,
        0,
      ),
    ).toBe(2);
  });

  it("TK-08.02 RF-21: groups the cancellation series by ISO week and calendar month", async () => {
    const [weekly, monthly] = await Promise.all([
      getKpis(hrId, { ...REPORT_RANGE, granularity: "WEEK" }),
      getKpis(hrId, { ...REPORT_RANGE, granularity: "MONTH" }),
    ]);

    expect(weekly.status).toBe(200);
    expect(weekly.body.cancellations).toEqual([
      {
        periodStart: "2026-10-19",
        periodEnd: "2026-10-25",
        scheduledAppointmentCount: 6,
        cancelledAppointmentCount: 1,
        cancellationRatePercent: 16.67,
      },
    ]);
    expect(monthly.status).toBe(200);
    expect(monthly.body.cancellations).toEqual([
      {
        periodStart: "2026-10-19",
        periodEnd: "2026-10-25",
        scheduledAppointmentCount: 6,
        cancelledAppointmentCount: 1,
        cancellationRatePercent: 16.67,
      },
    ]);
  });

  it("TK-08.02 RF-21: returns zero counts and null leaders when the period has no appointments", async () => {
    await prisma.appointment.deleteMany();

    const response = await getKpis(hrId).expect(200);

    expect(response.body.demand.byShift).toEqual([
      { shift: "MORNING", appointmentCount: 0 },
      { shift: "AFTERNOON", appointmentCount: 0 },
    ]);
    expect(response.body.demand.mostRequestedShift).toBeNull();
    expect(response.body.demand.mostRequestedWeekday).toBeNull();
    expect(response.body.demand.mostRequestedStartTime).toBeNull();
    expect(response.body.cancellations).toHaveLength(7);
    expect(
      response.body.cancellations.every(
        (period: { cancellationRatePercent: number }) => period.cancellationRatePercent === 0,
      ),
    ).toBe(true);
  });

  it("TK-08.02 RF-21: returns catalog errors for invalid dates, filters, and missing records", async () => {
    const invalidPeriod = await getKpis(hrId, { from: "2026-02-30", to: "2026-10-25" }).expect(400);
    expect(invalidPeriod.body.message).toBe("O período do relatório é inválido. Confira as datas e tente novamente.");

    const invalidFilter = await getKpis(hrId, { ...REPORT_RANGE, granularity: "YEAR" }).expect(400);
    expect(invalidFilter.body.message).toBe(
      "Os filtros do relatório são inválidos. Confira as informações e tente novamente.",
    );

    const missingLocation = await getKpis(hrId, {
      ...REPORT_RANGE,
      locationId: "00000000-0000-4000-8000-000000000099",
    }).expect(404);
    expect(missingLocation.body.message).toBe(
      "A unidade selecionada não foi encontrada. Confira a unidade e tente novamente.",
    );

    const missingTherapist = await getKpis(hrId, {
      ...REPORT_RANGE,
      therapistId: "00000000-0000-4000-8000-000000000099",
    }).expect(404);
    expect(missingTherapist.body.message).toBe("Massoterapeuta não encontrado.");
  });

  it("TK-08.02 RF-21: requires HR or ADMIN authorization", async () => {
    await request(app.getHttpServer()).get("/api/reports/kpis").query(REPORT_RANGE).expect(401);
    await getKpis(employeeId).expect(403);
    await getKpis(adminId).expect(200);
  });
});
