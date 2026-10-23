import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { FakeClock } from "../src/common/clock/fake-clock";
import { AppointmentCompletionJob } from "../src/attendance/jobs/appointment-completion.job";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-21T14:00:00.000Z");
const SESSION_DURATION_MS = 20 * 60_000;

describe("Appointment completion job (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let job: AppointmentCompletionJob;
  let clock: FakeClock;

  beforeAll(async () => {
    clock = new FakeClock(NOW);
    ({ app, prisma } = await createTestApp({ clock }));
    job = app.get(AppointmentCompletionJob);
  });

  beforeEach(async () => {
    clock.set(NOW);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "LONDRINA", name: "Londrina" } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFixture() {
    const [employee, therapistUser] = await Promise.all([
      prisma.user.create({ data: { email: "employee@example.com", name: "Carlos Lima", role: "EMPLOYEE" } }),
      prisma.user.create({ data: { email: "therapist@example.com", name: "Ana Souza", role: "THERAPIST" } }),
    ]);
    const therapist = await prisma.therapist.create({ data: { userId: therapistUser.id } });
    const room = await prisma.room.create({
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-2" },
    });
    return { employee, therapist, room };
  }

  async function createAppointment(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    startsAt: Date,
    status: AppointmentStatus,
    sessionStartedAt?: Date,
  ) {
    return prisma.appointment.create({
      data: {
        employeeId: fixture.employee.id,
        therapistId: fixture.therapist.id,
        roomId: fixture.room.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + SESSION_DURATION_MS),
        status,
        ...(status === "IN_PROGRESS" || sessionStartedAt ? { sessionStartedAt: sessionStartedAt ?? startsAt } : {}),
        ...(status === "CHECKED_IN" ? { checkedInAt: startsAt } : {}),
      },
    });
  }

  it("TK-05.04 RN-16: completes an overdue in-progress appointment once using the Clock instant", async () => {
    const fixture = await createFixture();
    const appointment = await createAppointment(fixture, new Date("2026-10-21T13:00:00.000Z"), "IN_PROGRESS");

    await job.run();
    clock.advanceMinutes(1);
    await job.run();

    await expect(prisma.appointment.findUnique({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "COMPLETED", sessionEndedAt: NOW }),
    );
  });

  it("TK-05.04 RN-16: leaves future and final appointments unchanged", async () => {
    const fixture = await createFixture();
    const future = await createAppointment(fixture, new Date("2026-10-21T14:30:00.000Z"), "IN_PROGRESS");
    const unchangedAppointments = await Promise.all(
      (["CANCELLED", "RELEASED", "NO_SHOW", "COMPLETED"] as const).map((status, index) =>
        createAppointment(
          fixture,
          new Date(new Date("2026-10-21T09:00:00.000Z").getTime() + index * 30 * 60_000),
          status,
        ),
      ),
    );
    const checkedInWithSessionStart = await createAppointment(
      fixture,
      new Date("2026-10-21T11:00:00.000Z"),
      "CHECKED_IN",
      new Date("2026-10-21T11:05:00.000Z"),
    );

    await job.run();

    await expect(prisma.appointment.findUnique({ where: { id: future.id } })).resolves.toEqual(
      expect.objectContaining({ status: "IN_PROGRESS", sessionEndedAt: null }),
    );
    for (const appointment of unchangedAppointments) {
      await expect(prisma.appointment.findUnique({ where: { id: appointment.id } })).resolves.toEqual(
        expect.objectContaining({ status: appointment.status, sessionEndedAt: null }),
      );
    }
    await expect(prisma.appointment.findUnique({ where: { id: checkedInWithSessionStart.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CHECKED_IN", sessionEndedAt: null }),
    );
  });

  it("TK-05.05 D-06 RN-16: completes an overdue checked-in appointment without a session start and records a system audit", async () => {
    const fixture = await createFixture();
    const appointment = await createAppointment(fixture, new Date("2026-10-21T13:00:00.000Z"), "CHECKED_IN");

    await job.run();
    clock.advanceMinutes(1);
    await job.run();

    await expect(prisma.appointment.findUnique({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "COMPLETED", sessionEndedAt: NOW, sessionStartedAt: null }),
    );
    await expect(
      prisma.auditEvent.findMany({ where: { entityId: appointment.id, action: "SESSION_AUTO_COMPLETED" } }),
    ).resolves.toEqual([
      expect.objectContaining({
        actorId: null,
        data: { from: "CHECKED_IN", to: "COMPLETED", actor: "SYSTEM" },
      }),
    ]);
    await expect(prisma.notification.count({ where: { appointmentId: appointment.id } })).resolves.toBe(0);
  });
});
