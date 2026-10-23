import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppointmentEvents } from "../src/booking/appointment-events";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");
const FUTURE_START = new Date("2026-10-21T14:00:00Z");
const FUTURE_END = new Date("2026-10-21T14:20:00Z");

describe("Appointment cancellation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cancellationEvent: { appointmentId: string; employeeId: string } | undefined;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(NOW) }));
    app.get(AppointmentEvents).onCancelled((event) => {
      cancellationEvent = event;
    });
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    cancellationEvent = undefined;
    await prisma.location.create({
      data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAppointment(start = FUTURE_START, end = FUTURE_END) {
    const [employee, therapistUser] = await Promise.all([
      prisma.user.create({
        data: { email: `employee-${Date.now()}@example.com`, name: "Ana Souza", role: "EMPLOYEE" },
      }),
      prisma.user.create({
        data: { email: `therapist-${Date.now()}@example.com`, name: "Bruno Lima", role: "THERAPIST" },
      }),
    ]);
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
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: start,
        endsAt: end,
        status: "CONFIRMED",
      },
    });
    return { employee, appointment };
  }

  it("RF-03 RN-01: cancels the employee appointment, emits the event, audits it, and confirms accessibly", async () => {
    const { employee, appointment } = await createAppointment();

    const response = await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: appointment.id,
        status: "CANCELLED",
        cancelledById: employee.id,
        spokenText: expect.stringMatching(/^Agendamento cancelado/),
      }),
    );
    expect(cancellationEvent).toEqual({ appointmentId: appointment.id, employeeId: employee.id });
    expect(
      await prisma.auditEvent.findFirst({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).not.toBeNull();
  });

  it("RF-03: does not allow an employee to cancel another employee's appointment", async () => {
    const { employee, appointment } = await createAppointment();
    const otherEmployee = await prisma.user.create({
      data: { email: "other@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", otherEmployee.id)
      .expect(404)
      .expect(({ body }) => expect(body.message).toBe("Agendamento não encontrado."));

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe("CONFIRMED");
    expect(employee.id).not.toBe(otherEmployee.id);
  });

  it("RN-01: rejects cancellation inside the minimum cancellation notice", async () => {
    const { employee, appointment } = await createAppointment(
      new Date("2026-10-19T13:30:00Z"),
      new Date("2026-10-19T13:50:00Z"),
    );

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", employee.id)
      .expect(400)
      .expect(({ body }) => expect(body.message).toBe("A antecedência mínima para cancelamento não foi respeitada."));
  });
});
