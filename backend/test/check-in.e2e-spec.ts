import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const STARTS_AT = new Date("2026-10-21T14:00:00.000Z");
const ENDS_AT = new Date("2026-10-21T14:20:00.000Z");

describe("Appointment check-in (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clock: FakeClock;

  beforeAll(async () => {
    clock = new FakeClock(new Date("2026-10-21T13:55:00.000Z"));
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(new Date("2026-10-21T13:55:00.000Z"));
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFixture(status: "CONFIRMED" | "CHECKED_IN" = "CONFIRMED") {
    const [employee, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" } }),
    ]);
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        employeeId: employee.id,
        therapistId: therapist.id,
        roomId: room.id,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status,
      },
    });
    return { employee, therapistUser, room, appointment };
  }

  it("TK-05.02 RF-06 RN-09 RN-02: changes CONFIRMED to CHECKED_IN and emits MSG-04 and MSG-05", async () => {
    const { employee, appointment } = await createFixture();

    const response = await request(app.getHttpServer())
      .post("/api/booking/check-in/token-1")
      .set("x-user-id", employee.id)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ status: "CHECKED_IN", checkedInAt: "2026-10-21T13:55:00.000Z" }),
    );
    expect(response.body.spokenText).toContain("Check-in confirmado");
    await expect(prisma.notification.count({ where: { appointmentId: appointment.id } })).resolves.toBe(2);
    await expect(
      prisma.notification.findFirst({
        where: { appointmentId: appointment.id, kind: "CHECK_IN_CONFIRMATION", recipientId: employee.id },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining("Check-in confirmado"),
        spokenText: expect.stringContaining("Check-in confirmado"),
      }),
    );
    await expect(
      prisma.notification.findFirst({ where: { appointmentId: appointment.id, kind: "EMPLOYEE_CHECKED_IN" } }),
    ).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining("Carlos") }));
  });

  it("TK-05.02 RF-06 RN-09: rejects a check-in before the configured window", async () => {
    const { employee } = await createFixture();
    clock.set(new Date("2026-10-21T13:29:00.000Z"));

    await request(app.getHttpServer())
      .post("/api/booking/check-in/token-1")
      .set("x-user-id", employee.id)
      .expect(404)
      .expect(({ body }) => {
        expect(body.message).toBe("O check-in ainda não está disponível.");
      });
  });

  it("TK-05.02 RF-06 RN-02: rejects a check-in after the late arrival tolerance", async () => {
    const { employee } = await createFixture();
    clock.set(new Date("2026-10-21T14:11:00.000Z"));

    await request(app.getHttpServer())
      .post("/api/booking/check-in/token-1")
      .set("x-user-id", employee.id)
      .expect(404)
      .expect(({ body }) => {
        expect(body.message).toBe("O limite de atraso para check-in foi excedido.");
      });
  });

  it("TK-05.02 RF-06: rejects invalid or inactive room tokens without revealing the token", async () => {
    const { employee, room } = await createFixture();
    await request(app.getHttpServer())
      .post("/api/booking/check-in/unknown-token")
      .set("x-user-id", employee.id)
      .expect(404)
      .expect(({ body }) => {
        expect(body.message).toBe("Código de check-in inválido.");
        expect(JSON.stringify(body)).not.toContain("unknown-token");
      });
    await prisma.room.update({ where: { id: room.id }, data: { active: false } });
    await request(app.getHttpServer()).post("/api/booking/check-in/token-1").set("x-user-id", employee.id).expect(404);
  });

  it("TK-05.02 RF-06: requires EMPLOYEE access for check-in", async () => {
    const { therapistUser } = await createFixture();

    await request(app.getHttpServer())
      .post("/api/booking/check-in/token-1")
      .set("x-user-id", therapistUser.id)
      .expect(403);
  });

  it("TK-05.02 RF-06 RN-02 RN-09: accepts exactly one of two simultaneous check-ins", async () => {
    const { employee } = await createFixture();

    const responses = await Promise.all([
      request(app.getHttpServer()).post("/api/booking/check-in/token-1").set("x-user-id", employee.id),
      request(app.getHttpServer()).post("/api/booking/check-in/token-1").set("x-user-id", employee.id),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    await expect(prisma.notification.count({ where: { kind: "CHECK_IN_CONFIRMATION" } })).resolves.toBe(1);
  });
});
