import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const MONDAY_9AM_IN_SAO_PAULO = new Date("2026-10-19T12:00:00Z");
const WEDNESDAY_9AM_IN_SAO_PAULO = new Date("2026-10-21T12:00:00Z");
const WEDNESDAY_9_20AM_IN_SAO_PAULO = new Date("2026-10-21T12:20:00Z");

describe("Status transitions on legacy routes (e2e)", () => {
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

  const createAppointment = async (status: AppointmentStatus) => {
    const employee = await prisma.user.create({
      data: { email: "ana@example.com", name: "Ana Souza", role: "EMPLOYEE" },
    });
    const therapistUser = await prisma.user.create({
      data: { email: "bruno@example.com", name: "Bruno Lima", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: SAO_PAULO_LOCATION_ID, name: "Sala 1", checkInToken: "token-sala-1" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: WEDNESDAY_9AM_IN_SAO_PAULO,
        endsAt: WEDNESDAY_9_20AM_IN_SAO_PAULO,
        status,
      },
    });
    return { employee, therapistUser, appointment };
  };

  it("RF-14: the therapist starts a POSSIBLE_NO_SHOW appointment", async () => {
    const { therapistUser, appointment } = await createAppointment("POSSIBLE_NO_SHOW");

    const response = await request(app.getHttpServer())
      .post(`/api/therapist/appointments/${appointment.id}/start`)
      .set("x-user-id", therapistUser.id)
      .expect(201);

    expect(response.body).toEqual(expect.objectContaining({ id: appointment.id, status: "IN_PROGRESS" }));
  });

  it("RF-03: the employee cannot cancel a CHECKED_IN appointment and hears the catalog message", async () => {
    const { employee, appointment } = await createAppointment("CHECKED_IN");

    const response = await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${appointment.id}`)
      .set("x-user-id", employee.id)
      .expect(409);

    expect(response.body.message).toBe(messages.errors.invalidStatusTransition);
    expect(JSON.stringify(response.body)).not.toMatch(/CHECKED_IN|CANCELLED|EMPLOYEE|transition/);
    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CHECKED_IN" }),
    );
  });
});
