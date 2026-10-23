import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");
const STARTS_AT = "2026-10-21T14:00:00.000Z";
const ENDS_AT = "2026-10-21T14:20:00.000Z";

describe("Appointment booking (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(NOW) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({
      data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFixture() {
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
    return { employee, therapist, room };
  }

  it("RF-02 RN-01 RN-06 RN-12: creates a confirmed appointment with audit and spoken confirmation", async () => {
    const { employee, therapist, room } = await createFixture();

    const response = await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({ therapistId: therapist.id, roomId: room.id, startsAt: STARTS_AT, endsAt: ENDS_AT })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        status: "CONFIRMED",
        spokenText: expect.stringContaining("Reserva confirmada"),
      }),
    );
    const appointment = await prisma.appointment.findFirstOrThrow({ where: { employeeId: employee.id } });
    expect(
      await prisma.auditEvent.findFirst({ where: { entityId: appointment.id, action: "APPOINTMENT_CREATED" } }),
    ).not.toBeNull();
    expect(
      await prisma.notification.findFirst({ where: { appointmentId: appointment.id, kind: "BOOKING_CONFIRMATION" } }),
    ).not.toBeNull();
  });

  it("RN-12: rejects an appointment overlapping an existing appointment on the same room", async () => {
    const { employee, therapist, room } = await createFixture();
    const [otherEmployee, otherTherapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "other@example.com", name: "Carlos Lima", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "other-therapist@example.com", name: "Diana Lima", role: "THERAPIST" } }),
    ]);
    const otherTherapist = await prisma.therapist.create({ data: { userId: otherTherapistUser.id } });
    await prisma.appointment.create({
      data: {
        employeeId: otherEmployee.id,
        therapistId: otherTherapist.id,
        roomId: room.id,
        startsAt: new Date(STARTS_AT),
        endsAt: new Date(ENDS_AT),
        status: "CONFIRMED",
      },
    });

    await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({ therapistId: therapist.id, roomId: room.id, startsAt: STARTS_AT, endsAt: ENDS_AT })
      .expect(409)
      .expect(({ body }) => expect(body.message).toBe("O horário não está disponível."));
  });

  it("RN-12: allows exactly one of two simultaneous reservations for the same slot", async () => {
    const { therapist, room } = await createFixture();
    const employees = await Promise.all([
      prisma.user.create({ data: { email: "first@example.com", name: "First Employee", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "second@example.com", name: "Second Employee", role: "EMPLOYEE" } }),
    ]);
    const body = { therapistId: therapist.id, roomId: room.id, startsAt: STARTS_AT, endsAt: ENDS_AT };

    const responses = await Promise.all(
      employees.map((employee) =>
        request(app.getHttpServer()).post("/api/booking/appointments").set("x-user-id", employee.id).send(body),
      ),
    );

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect(
      await prisma.appointment.count({ where: { therapistId: therapist.id, startsAt: new Date(STARTS_AT) } }),
    ).toBe(1);
  });
});
