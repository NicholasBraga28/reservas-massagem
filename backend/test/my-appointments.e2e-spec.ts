import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");

describe("My appointments (e2e)", () => {
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
        name: `Room ${Date.now()}`,
        checkInToken: `token-${Date.now()}-${Math.random()}`,
      },
    });
    return prisma.appointment.create({
      data: {
        employeeId,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date(startsAt),
        endsAt: new Date(new Date(startsAt).getTime() + 20 * 60_000),
        status,
      },
    });
  }

  it("RF-07: separates only the employee's appointments into chronologically ordered upcoming and past lists", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    const otherEmployee = await createEmployee("other@example.com", "Other Employee");
    await createAppointment(employee.id, "2026-10-18T14:00:00Z", "CANCELLED");
    await createAppointment(employee.id, "2026-10-21T15:00:00Z");
    await createAppointment(employee.id, "2026-10-20T14:00:00Z");
    await createAppointment(otherEmployee.id, "2026-10-21T13:00:00Z");

    const response = await request(app.getHttpServer())
      .get("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body.upcoming).toHaveLength(2);
    expect(response.body.past).toHaveLength(1);
    expect(response.body.upcoming.map(({ startsAt }: { startsAt: string }) => startsAt)).toEqual([
      "2026-10-20T14:00:00.000Z",
      "2026-10-21T15:00:00.000Z",
    ]);
    expect(response.body.past[0].status).toBe("CANCELLED");
    expect(response.body.spokenText).toMatch(/^Você tem 2 próximos agendamentos\./);
  });

  it("RF-07: applies status and interval filters and can exclude past appointments", async () => {
    const employee = await createEmployee("employee@example.com", "Carlos Lima");
    await createAppointment(employee.id, "2026-10-18T14:00:00Z", "CANCELLED");
    await createAppointment(employee.id, "2026-10-21T15:00:00Z");

    const response = await request(app.getHttpServer())
      .get("/api/booking/appointments")
      .query({ status: "CONFIRMED", from: "2026-10-20T00:00:00Z", to: "2026-10-22T00:00:00Z", includePast: "false" })
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body.past).toEqual([]);
    expect(response.body.upcoming).toHaveLength(1);
    expect(response.body.upcoming[0]).toEqual(
      expect.objectContaining({
        status: "CONFIRMED",
        therapistName: "Ana Souza",
        roomName: expect.any(String),
        locationCode: "SAO_PAULO",
      }),
    );
  });
});
