import { UserRole } from "@prisma/client";
import { SLOT_OCCUPYING_STATUSES } from "../src/appointments/appointment-status";
import { BusinessRules, parseBusinessRules } from "../src/config/business-rules.config";
import { PrismaBusinessRulesRepository } from "../src/business-rules/prisma-business-rules.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { generateUpcomingWorkPeriods, SchedulePeriod } from "./demo-seed-schedule";

const DEMO_TIMEZONE = "America/Sao_Paulo";

const SAO_PAULO_LOCATION_ID = "00000000-0000-4000-8000-000000000001";
const LONDRINA_LOCATION_ID = "00000000-0000-4000-8000-000000000002";

type DemoUser = Readonly<{ id: string; email: string; name: string; role: UserRole }>;

const DEMO_USERS = {
  therapistSaoPaulo: {
    id: "00000000-0000-4000-8000-000000000101",
    email: "marina.castro.demo@example.com",
    name: "Marina Castro",
    role: "THERAPIST",
  },
  therapistLondrina: {
    id: "00000000-0000-4000-8000-000000000102",
    email: "felipe.nogueira.demo@example.com",
    name: "Felipe Nogueira",
    role: "THERAPIST",
  },
  employeeOne: {
    id: "00000000-0000-4000-8000-000000000103",
    email: "beatriz.lima.demo@example.com",
    name: "Beatriz Lima",
    role: "EMPLOYEE",
  },
  employeeTwo: {
    id: "00000000-0000-4000-8000-000000000104",
    email: "rafael.pires.demo@example.com",
    name: "Rafael Pires",
    role: "EMPLOYEE",
  },
  employeeThree: {
    id: "00000000-0000-4000-8000-000000000105",
    email: "camila.duarte.demo@example.com",
    name: "Camila Duarte",
    role: "EMPLOYEE",
  },
  hr: {
    id: "00000000-0000-4000-8000-000000000106",
    email: "juliana.ramos.demo@example.com",
    name: "Juliana Ramos",
    role: "HR",
  },
  admin: {
    id: "00000000-0000-4000-8000-000000000107",
    email: "eduardo.santos.demo@example.com",
    name: "Eduardo Santos",
    role: "ADMIN",
  },
} as const satisfies Record<string, DemoUser>;

const THERAPIST_SAO_PAULO_ID = "00000000-0000-4000-8000-000000000111";
const THERAPIST_LONDRINA_ID = "00000000-0000-4000-8000-000000000112";

const ROOM_SAO_PAULO_1_ID = "00000000-0000-4000-8000-000000000121";
const ROOM_SAO_PAULO_2_ID = "00000000-0000-4000-8000-000000000122";
const ROOM_LONDRINA_1_ID = "00000000-0000-4000-8000-000000000123";
const ROOM_LONDRINA_2_ID = "00000000-0000-4000-8000-000000000124";

type LocationSeed = Readonly<{ id: string; code: "SAO_PAULO" | "LONDRINA"; name: string }>;
type RoomSeed = Readonly<{ id: string; locationId: string; name: string; checkInToken: string }>;
type ScheduleRefresh = Readonly<{ therapistId: string; roomId: string; periods: readonly SchedulePeriod[]; now: Date }>;

function upsertUser(prisma: PrismaService, user: DemoUser) {
  return prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email, name: user.name, role: user.role, status: "ACTIVE" },
    create: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}

function upsertTherapist(prisma: PrismaService, therapistId: string, userId: string) {
  return prisma.therapist.upsert({
    where: { id: therapistId },
    update: { userId },
    create: { id: therapistId, userId },
  });
}

function upsertLocation(prisma: PrismaService, location: LocationSeed) {
  return prisma.location.upsert({ where: { code: location.code }, update: { name: location.name }, create: location });
}

function upsertRoom(prisma: PrismaService, room: RoomSeed) {
  return prisma.room.upsert({
    where: { locationId_name: { locationId: room.locationId, name: room.name } },
    update: { active: true },
    create: room,
  });
}

async function currentBusinessRules(prisma: PrismaService): Promise<BusinessRules> {
  const stored = await new PrismaBusinessRulesRepository(prisma).findCurrent();
  if (stored) return stored;
  return parseBusinessRules(process.env);
}

function partitionByAppointment<T extends SchedulePeriod>(
  slots: readonly T[],
  appointments: readonly SchedulePeriod[],
): { slotsToKeep: T[]; slotsToDelete: T[] } {
  const hasAppointment = (slot: T) => appointments.some((a) => a.startsAt >= slot.startsAt && a.endsAt <= slot.endsAt);
  const slotsToKeep: T[] = [];
  const slotsToDelete: T[] = [];
  for (const slot of slots) (hasAppointment(slot) ? slotsToKeep : slotsToDelete).push(slot);
  return { slotsToKeep, slotsToDelete };
}

async function refreshScheduleSlots(prisma: PrismaService, refresh: ScheduleRefresh): Promise<void> {
  const { therapistId, roomId, periods, now } = refresh;
  const [futureSlots, futureAppointments] = await Promise.all([
    prisma.scheduleSlot.findMany({ where: { therapistId, roomId, startsAt: { gt: now } } }),
    prisma.appointment.findMany({
      where: { therapistId, roomId, startsAt: { gt: now }, status: { in: [...SLOT_OCCUPYING_STATUSES] } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const { slotsToKeep, slotsToDelete } = partitionByAppointment(futureSlots, futureAppointments);
  if (slotsToDelete.length > 0) {
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: slotsToDelete.map((slot) => slot.id) } } });
  }

  const isAlreadyPresent = (period: SchedulePeriod) =>
    slotsToKeep.some(
      (slot) =>
        slot.startsAt.getTime() === period.startsAt.getTime() && slot.endsAt.getTime() === period.endsAt.getTime(),
    );
  const periodsToCreate = periods.filter((period) => !isAlreadyPresent(period));

  if (periodsToCreate.length > 0) {
    await prisma.scheduleSlot.createMany({
      data: periodsToCreate.map((period) => ({
        therapistId,
        roomId,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      })),
    });
  }
}

function printDemoUsers(users: readonly DemoUser[]): void {
  console.log("Usuários de demonstração (use o ID no cabeçalho x-user-id):");
  for (const user of users) {
    console.log(`- ${user.role}: ${user.name} (${user.id})`);
  }
}

export async function seedDemoData(prisma: PrismaService, now: Date = new Date()): Promise<void> {
  await Promise.all([
    upsertLocation(prisma, { id: SAO_PAULO_LOCATION_ID, code: "SAO_PAULO", name: "São Paulo" }),
    upsertLocation(prisma, { id: LONDRINA_LOCATION_ID, code: "LONDRINA", name: "Londrina" }),
  ]);

  await Promise.all([
    upsertRoom(prisma, {
      id: ROOM_SAO_PAULO_1_ID,
      locationId: SAO_PAULO_LOCATION_ID,
      name: "Sala 1",
      checkInToken: "demo-sao-paulo-sala-1",
    }),
    upsertRoom(prisma, {
      id: ROOM_SAO_PAULO_2_ID,
      locationId: SAO_PAULO_LOCATION_ID,
      name: "Sala 2",
      checkInToken: "demo-sao-paulo-sala-2",
    }),
    upsertRoom(prisma, {
      id: ROOM_LONDRINA_1_ID,
      locationId: LONDRINA_LOCATION_ID,
      name: "Sala 1",
      checkInToken: "demo-londrina-sala-1",
    }),
    upsertRoom(prisma, {
      id: ROOM_LONDRINA_2_ID,
      locationId: LONDRINA_LOCATION_ID,
      name: "Sala 2",
      checkInToken: "demo-londrina-sala-2",
    }),
  ]);

  await Promise.all(Object.values(DEMO_USERS).map((user) => upsertUser(prisma, user)));
  await Promise.all([
    upsertTherapist(prisma, THERAPIST_SAO_PAULO_ID, DEMO_USERS.therapistSaoPaulo.id),
    upsertTherapist(prisma, THERAPIST_LONDRINA_ID, DEMO_USERS.therapistLondrina.id),
  ]);

  const rules = await currentBusinessRules(prisma);
  const periods = generateUpcomingWorkPeriods(rules, now, DEMO_TIMEZONE);

  await Promise.all([
    refreshScheduleSlots(prisma, { therapistId: THERAPIST_SAO_PAULO_ID, roomId: ROOM_SAO_PAULO_1_ID, periods, now }),
    refreshScheduleSlots(prisma, { therapistId: THERAPIST_LONDRINA_ID, roomId: ROOM_LONDRINA_1_ID, periods, now }),
  ]);
}

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await seedDemoData(prisma);
    printDemoUsers(Object.values(DEMO_USERS));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
