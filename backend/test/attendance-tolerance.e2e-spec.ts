import { INestApplication } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { FakeClock } from "../src/common/clock/fake-clock";
import { AttendanceToleranceJob } from "../src/attendance/jobs/attendance-tolerance.job";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-21T14:11:00.000Z");

describe("Attendance tolerance job (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let job: AttendanceToleranceJob;
  let clock: FakeClock;

  beforeAll(async () => {
    clock = new FakeClock(NOW);
    ({ app, prisma } = await createTestApp({ clock }));
    job = app.get(AttendanceToleranceJob);
  });

  beforeEach(async () => {
    clock.set(NOW);
    await truncateAllTables(prisma);
    await prisma.location.create({ data: { id: LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" } });
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
      data: { locationId: LOCATION_ID, name: "Sala 1", checkInToken: "token-1" },
    });
    return { employee, therapistUser, therapist, room };
  }

  async function createAppointment(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    startsAt: Date,
    status: AppointmentStatus = "CONFIRMED",
  ) {
    return prisma.appointment.create({
      data: {
        employeeId: fixture.employee.id,
        therapistId: fixture.therapist.id,
        roomId: fixture.room.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 20 * 60_000),
        status,
      },
    });
  }

  it("TK-05.03 RN-02: marks an overdue confirmed appointment as POSSIBLE_NO_SHOW and notifies its therapist once", async () => {
    const fixture = await createFixture();
    const appointment = await createAppointment(fixture, new Date("2026-10-21T14:00:00.000Z"));

    await job.run();
    await job.run();

    await expect(prisma.appointment.findUnique({ where: { id: appointment.id } })).resolves.toEqual(
      expect.objectContaining({ status: "POSSIBLE_NO_SHOW" }),
    );
    await expect(
      prisma.notification.findMany({ where: { appointmentId: appointment.id, kind: "POSSIBLE_NO_SHOW" } }),
    ).resolves.toEqual([
      expect.objectContaining({
        recipientId: fixture.therapistUser.id,
        message: expect.stringContaining("Carlos"),
        spokenText: expect.stringContaining("Carlos"),
      }),
    ]);
  });

  it("TK-05.03 RN-02: leaves future, within-tolerance, and non-confirmed appointments unchanged", async () => {
    const fixture = await createFixture();
    const future = await createAppointment(fixture, new Date("2026-10-21T14:30:00.000Z"));
    const withinTolerance = await createAppointment(fixture, new Date("2026-10-21T14:05:00.000Z"));
    const ineligibleAppointments = await Promise.all(
      (["CHECKED_IN", "IN_PROGRESS", "CANCELLED", "RELEASED", "NO_SHOW", "COMPLETED"] as const).map((status, index) =>
        createAppointment(
          fixture,
          new Date(new Date("2026-10-21T10:00:00.000Z").getTime() + index * 30 * 60_000),
          status,
        ),
      ),
    );

    await job.run();

    await expect(prisma.appointment.findUnique({ where: { id: future.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CONFIRMED" }),
    );
    await expect(prisma.appointment.findUnique({ where: { id: withinTolerance.id } })).resolves.toEqual(
      expect.objectContaining({ status: "CONFIRMED" }),
    );
    for (const appointment of ineligibleAppointments) {
      await expect(prisma.appointment.findUnique({ where: { id: appointment.id } })).resolves.toEqual(
        expect.objectContaining({ status: appointment.status }),
      );
    }
    await expect(prisma.notification.count({ where: { kind: "POSSIBLE_NO_SHOW" } })).resolves.toBe(0);
  });
});
