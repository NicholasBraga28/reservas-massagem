import { INestApplication } from "@nestjs/common";
import { AppointmentStatus, Room, Therapist, User } from "@prisma/client";
import { SLOT_OCCUPYING_STATUSES } from "../src/appointments/appointment-status";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const SAO_PAULO_LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const AT_2PM_IN_SAO_PAULO = new Date("2026-10-21T17:00:00Z");
const AT_2_10PM_IN_SAO_PAULO = new Date("2026-10-21T17:10:00Z");
const AT_2_20PM_IN_SAO_PAULO = new Date("2026-10-21T17:20:00Z");
const AT_2_30PM_IN_SAO_PAULO = new Date("2026-10-21T17:30:00Z");
const AT_2_40PM_IN_SAO_PAULO = new Date("2026-10-21T17:40:00Z");
const NOT_NULL_VIOLATION = /Code: `23502`/;

type AppointmentInput = Readonly<{
  therapist: Therapist;
  room: Room;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}>;

describe("Appointment overlap constraints (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employee: User;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
    await prisma.location.create({
      data: { id: SAO_PAULO_LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" },
    });
    employee = await prisma.user.create({ data: { email: "ana@example.com", name: "Ana Souza", role: "EMPLOYEE" } });
  });

  afterAll(async () => {
    await app.close();
  });

  const createTherapist = async (email: string) => {
    const user = await prisma.user.create({ data: { email, name: "Bruno Lima", role: "THERAPIST" } });
    return prisma.therapist.create({ data: { userId: user.id } });
  };

  const createRoom = (name: string) =>
    prisma.room.create({ data: { locationId: SAO_PAULO_LOCATION_ID, name, checkInToken: `token-${name}` } });

  const createAppointment = ({ therapist, room, startsAt, endsAt, status }: AppointmentInput) =>
    prisma.appointment.create({
      data: { employeeId: employee.id, therapistId: therapist.id, roomId: room.id, startsAt, endsAt, status },
    });

  it.each(SLOT_OCCUPYING_STATUSES)(
    "RN-12: rejects a %s appointment overlapping a CONFIRMED one of the same therapist",
    async (status) => {
      const therapist = await createTherapist("bruno@example.com");
      const [firstRoom, secondRoom] = await Promise.all([createRoom("Sala 1"), createRoom("Sala 2")]);
      await createAppointment({
        therapist,
        room: firstRoom,
        startsAt: AT_2PM_IN_SAO_PAULO,
        endsAt: AT_2_20PM_IN_SAO_PAULO,
        status: "CONFIRMED",
      });

      const overlapping = createAppointment({
        therapist,
        room: secondRoom,
        startsAt: AT_2_10PM_IN_SAO_PAULO,
        endsAt: AT_2_30PM_IN_SAO_PAULO,
        status,
      });

      await expect(overlapping).rejects.toThrow(/appointments_therapist_no_overlap/);
    },
  );

  it.each(SLOT_OCCUPYING_STATUSES)(
    "RN-12: rejects a %s appointment of another therapist in the room of a CONFIRMED one at the same time",
    async (status) => {
      const [bruno, diana] = await Promise.all([
        createTherapist("bruno@example.com"),
        createTherapist("diana@example.com"),
      ]);
      const room = await createRoom("Sala 1");
      await createAppointment({
        therapist: bruno,
        room,
        startsAt: AT_2PM_IN_SAO_PAULO,
        endsAt: AT_2_20PM_IN_SAO_PAULO,
        status: "CONFIRMED",
      });

      const overlapping = createAppointment({
        therapist: diana,
        room,
        startsAt: AT_2PM_IN_SAO_PAULO,
        endsAt: AT_2_20PM_IN_SAO_PAULO,
        status,
      });

      await expect(overlapping).rejects.toThrow(/appointments_room_no_overlap/);
    },
  );

  it.each<AppointmentStatus>(["CANCELLED", "RELEASED"])(
    "RN-12: a %s appointment frees its slot for the same therapist and room",
    async (status) => {
      const therapist = await createTherapist("bruno@example.com");
      const room = await createRoom("Sala 1");
      await createAppointment({
        therapist,
        room,
        startsAt: AT_2PM_IN_SAO_PAULO,
        endsAt: AT_2_20PM_IN_SAO_PAULO,
        status,
      });

      const sameSlot = createAppointment({
        therapist,
        room,
        startsAt: AT_2PM_IN_SAO_PAULO,
        endsAt: AT_2_20PM_IN_SAO_PAULO,
        status: "CONFIRMED",
      });

      await expect(sameSlot).resolves.toEqual(expect.objectContaining({ status: "CONFIRMED" }));
    },
  );

  it("RN-12: accepts an appointment starting exactly when the previous one ends", async () => {
    const therapist = await createTherapist("bruno@example.com");
    const room = await createRoom("Sala 1");
    await createAppointment({
      therapist,
      room,
      startsAt: AT_2PM_IN_SAO_PAULO,
      endsAt: AT_2_20PM_IN_SAO_PAULO,
      status: "CONFIRMED",
    });

    const backToBack = createAppointment({
      therapist,
      room,
      startsAt: AT_2_20PM_IN_SAO_PAULO,
      endsAt: AT_2_40PM_IN_SAO_PAULO,
      status: "CONFIRMED",
    });

    await expect(backToBack).resolves.toEqual(expect.objectContaining({ startsAt: AT_2_20PM_IN_SAO_PAULO }));
  });

  it("RN-12: the database rejects an appointment without a room", async () => {
    const therapist = await createTherapist("bruno@example.com");

    const withoutRoom = prisma.$executeRaw`
      INSERT INTO "appointments" ("id", "employee_id", "therapist_id", "starts_at", "ends_at", "status", "updated_at")
      VALUES (gen_random_uuid(), ${employee.id}::uuid, ${therapist.id}::uuid, ${AT_2PM_IN_SAO_PAULO}, ${AT_2_20PM_IN_SAO_PAULO}, 'CONFIRMED', now())`;

    await expect(withoutRoom).rejects.toThrow(NOT_NULL_VIOLATION);
  });
});
