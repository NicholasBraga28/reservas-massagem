import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-19T12:00:00Z");
const CURRENT_START = "2026-10-21T14:00:00.000Z";
const CURRENT_END = "2026-10-21T14:20:00.000Z";
const NEW_START = "2026-10-21T16:00:00.000Z";
const NEW_END = "2026-10-21T16:20:00.000Z";

describe("Rescheduling outside MVP (e2e)", () => {
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

  async function createFixture() {
    const employee = await prisma.user.create({
      data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" },
    });
    const therapistUser = await prisma.user.create({
      data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" },
    });
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    await prisma.scheduleSlot.create({
      data: {
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: new Date("2026-10-21T13:00:00Z"),
        endsAt: new Date("2026-10-21T17:00:00Z"),
      },
    });
    return { employee, therapist, room };
  }

  it("RF-08 D-03: follows the MVP flow by cancelling the current appointment and creating a new booking", async () => {
    const { employee, therapist, room } = await createFixture();
    const current = await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({ therapistId: therapist.id, roomId: room.id, startsAt: CURRENT_START, endsAt: CURRENT_END })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/booking/appointments/${current.body.id}`)
      .set("x-user-id", employee.id)
      .expect(200);

    const replacement = await request(app.getHttpServer())
      .post("/api/booking/appointments")
      .set("x-user-id", employee.id)
      .send({ therapistId: therapist.id, roomId: room.id, startsAt: NEW_START, endsAt: NEW_END })
      .expect(201);

    expect(replacement.body).toEqual(
      expect.objectContaining({ status: "CONFIRMED", startsAt: NEW_START, endsAt: NEW_END }),
    );
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: current.body.id } })).status).toBe("CANCELLED");
  });

  it("RF-08 D-03: does not expose an atomic rescheduling endpoint in the MVP", async () => {
    const { employee } = await createFixture();

    await request(app.getHttpServer())
      .post("/api/booking/appointments/reschedule")
      .set("x-user-id", employee.id)
      .send({ appointmentId: "00000000-0000-4000-8000-000000000000", startsAt: NEW_START, endsAt: NEW_END })
      .expect(404);
  });
});
