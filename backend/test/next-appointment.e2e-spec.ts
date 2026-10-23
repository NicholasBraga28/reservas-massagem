import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");

describe("Next employee appointment (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock: new FakeClock(NOW) }));
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createEmployee(email: string, name: string) {
    return prisma.user.create({ data: { email, name, role: "EMPLOYEE" } });
  }

  async function createAppointment(
    employeeId: string,
    startsAt: string,
    status: "CONFIRMED" | "CANCELLED" = "CONFIRMED",
  ) {
    const therapistUser = await prisma.user.create({
      data: { email: `therapist-${Date.now()}-${Math.random()}@example.com`, name: "Ana Souza", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: {
        locationId: LOCATION_ID,
        name: `Sala ${Date.now()}-${Math.random()}`,
        checkInToken: `token-${Date.now()}-${Math.random()}`,
      },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(new Date(startsAt).getTime() + 20 * 60_000),
        status,
      },
    });
    return { appointment, roomName: room.name };
  }

  it("RF-09: returns the earliest future confirmed appointment with accessible date, time, therapist, and room", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    const otherEmployee = await createEmployee("other@example.com", "Other Employee");
    await createAppointment(employee.id, "2026-10-21T15:00:00Z");
    const next = await createAppointment(employee.id, "2026-10-21T12:00:00Z");
    await createAppointment(employee.id, "2026-10-21T11:00:00Z", "CANCELLED");
    await createAppointment(otherEmployee.id, "2026-10-21T10:00:00Z");

    const response = await request(app.getHttpServer())
      .get("/api/booking/appointments/next")
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual({
      appointment: expect.objectContaining({
        id: next.appointment.id,
        startsAt: "2026-10-21T12:00:00.000Z",
        status: "CONFIRMED",
        therapistName: "Ana Souza",
        roomName: next.roomName,
        locationCode: "SAO_PAULO",
      }),
      spokenText: `Sua próxima sessão é quarta-feira, às 9h, com Ana, na ${next.roomName}.`,
    });
  });

  it("RF-09: returns a short empty response when the employee has no future confirmed appointment", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    await createAppointment(employee.id, "2026-10-18T12:00:00Z", "CANCELLED");

    const response = await request(app.getHttpServer())
      .get("/api/booking/appointments/next")
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual({ appointment: null, spokenText: "Você não tem próxima sessão agendada." });
  });
});
