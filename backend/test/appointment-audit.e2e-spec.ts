import { INestApplication } from "@nestjs/common";
import { AppointmentEvents } from "../src/booking/appointment-events";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const STARTS_AT = new Date("2026-10-21T14:00:00Z");
const ENDS_AT = new Date("2026-10-21T14:20:00Z");

describe("Appointment audit listener (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let events: AppointmentEvents;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    events = app.get(AppointmentEvents);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAppointment() {
    const [employee, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" } }),
    ]);
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    return prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status: "CONFIRMED",
      },
    });
  }

  it("TK-04.08 RF-02: audits appointment.booked with actor, entity, and minimal metadata", async () => {
    const appointment = await createAppointment();

    await events.emitBooked({ appointmentId: appointment.id, employeeId: appointment.employeeId });

    await expect(
      prisma.auditEvent.findFirst({ where: { entityId: appointment.id, action: "APPOINTMENT_CREATED" } }),
    ).resolves.toEqual(
      expect.objectContaining({
        actorId: appointment.employeeId,
        entityType: "Appointment",
        entityId: appointment.id,
        data: { status: "CONFIRMED" },
      }),
    );
  });

  it("TK-04.08 RF-03: audits appointment.cancelled and ignores duplicate event delivery", async () => {
    const appointment = await createAppointment();

    await events.emitCancelled({ appointmentId: appointment.id, employeeId: appointment.employeeId });
    await events.emitCancelled({ appointmentId: appointment.id, employeeId: appointment.employeeId });

    await expect(
      prisma.auditEvent.count({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.findFirst({ where: { entityId: appointment.id, action: "APPOINTMENT_CANCELLED" } }),
    ).resolves.toEqual(
      expect.objectContaining({
        actorId: appointment.employeeId,
        entityType: "Appointment",
        data: { status: "CANCELLED" },
      }),
    );
  });
});
