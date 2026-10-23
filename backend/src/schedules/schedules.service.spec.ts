import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import { businessRulesServiceWith } from "../business-rules/business-rules.testing";
import { CLOCK } from "../common/clock/clock";
import { FakeClock } from "../common/clock/fake-clock";
import { BusinessRules } from "../config/business-rules.config";
import { PolicyService } from "../domain/policy.service";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulesService } from "./schedules.service";

const TIMEZONE = "America/Sao_Paulo";
const CREATED_AT = new Date("2026-10-21T15:00:00.000Z");
const THERAPIST_ID = "therapist-1";
const OTHER_THERAPIST_ID = "therapist-2";
const ROOM_ID = "room-a";
const OTHER_ROOM_ID = "room-b";
const ACTOR_ID = "hr-1";

type StoredSlot = {
  id: string;
  therapistId: string;
  roomId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
};

type SlotData = Pick<StoredSlot, "therapistId" | "roomId" | "startsAt" | "endsAt">;

const at = (localDateTime: string): Date => new Date(`${localDateTime}:00.000-03:00`);

class FakePrisma {
  readonly slots: StoredSlot[] = [];
  readonly therapists = new Map([
    [THERAPIST_ID, { id: THERAPIST_ID, user: { status: "ACTIVE" } }],
    [OTHER_THERAPIST_ID, { id: OTHER_THERAPIST_ID, user: { status: "ACTIVE" } }],
  ]);
  readonly rooms = new Map([
    [ROOM_ID, { id: ROOM_ID, active: true, location: { timezone: TIMEZONE } }],
    [OTHER_ROOM_ID, { id: OTHER_ROOM_ID, active: true, location: { timezone: TIMEZONE } }],
  ]);

  readonly therapist = { findUnique: async ({ where }: { where: { id: string } }) => this.therapists.get(where.id) };
  readonly room = { findUnique: async ({ where }: { where: { id: string } }) => this.rooms.get(where.id) };
  readonly appointment = { findMany: async () => [] };
  readonly scheduleSlot = {
    findMany: async () => [...this.slots],
    findUnique: async ({ where }: { where: { id: string } }) => this.slots.find((slot) => slot.id === where.id),
    create: async ({ data }: { data: SlotData }) => this.store({ ...data, id: randomUUID(), createdAt: CREATED_AT }),
    update: async ({ where, data }: { where: { id: string }; data: Partial<SlotData> }) => {
      const slot = this.slots.find((candidate) => candidate.id === where.id);
      if (!slot) throw new NotFoundException();
      return Object.assign(slot, data);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const index = this.slots.findIndex((slot) => slot.id === where.id);
      return this.slots.splice(index, 1)[0];
    },
  };

  $transaction<T>(work: (tx: this) => Promise<T>): Promise<T> {
    return work(this);
  }

  store(slot: StoredSlot): StoredSlot {
    this.slots.push(slot);
    return { ...slot };
  }

  seed(data: SlotData): StoredSlot {
    return this.store({ ...data, id: randomUUID(), createdAt: CREATED_AT });
  }
}

describe("SchedulesService", () => {
  let prisma: FakePrisma;
  let audit: { record: jest.Mock };
  let service: SchedulesService;

  const serviceWith = async (rules: Partial<BusinessRules> = {}): Promise<SchedulesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulesService,
        PolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: BusinessRulesService, useValue: businessRulesServiceWith(rules) },
        { provide: CLOCK, useValue: new FakeClock(new Date("2026-10-21T12:00:00.000Z")) },
      ],
    }).compile();
    return moduleRef.get(SchedulesService);
  };

  beforeEach(async () => {
    prisma = new FakePrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = await serviceWith();
  });

  const create = (overrides: Partial<{ therapistId: string; roomId: string; startsAt: string; endsAt: string }>) =>
    service.create(ACTOR_ID, {
      therapistId: THERAPIST_ID,
      roomId: ROOM_ID,
      startsAt: at("2026-10-26T09:00").toISOString(),
      endsAt: at("2026-10-26T17:00").toISOString(),
      ...overrides,
    });

  describe("create", () => {
    it("RF-25: creates a period and answers with the contract fields", async () => {
      const created = await create({});

      expect(created).toEqual({
        id: expect.any(String),
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: new Date("2026-10-26T12:00:00.000Z"),
        endsAt: new Date("2026-10-26T20:00:00.000Z"),
        createdAt: CREATED_AT,
      });
    });

    it("RF-25: records an audit event with the period identifiers and times", async () => {
      const created = await create({});

      expect(audit.record).toHaveBeenCalledWith(ACTOR_ID, "SCHEDULE_SLOT_CREATED", "ScheduleSlot", created.id, {
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: "2026-10-26T12:00:00.000Z",
        endsAt: "2026-10-26T20:00:00.000Z",
      });
    });

    it("RF-25: refuses a period whose end is not after its start", async () => {
      await expect(
        create({ startsAt: at("2026-10-26T13:00").toISOString(), endsAt: at("2026-10-26T13:00").toISOString() }),
      ).rejects.toThrow(messages.errors.invalidPeriod);
      expect(prisma.slots).toHaveLength(0);
    });

    it("RF-25: refuses a period that crosses midnight in America/Sao_Paulo", async () => {
      service = await serviceWith({ workDays: [1, 2, 3, 4, 5, 6, 7], workStartMinutes: 0, workEndMinutes: 1440 });

      await expect(
        create({ startsAt: at("2026-10-26T23:00").toISOString(), endsAt: at("2026-10-27T01:00").toISOString() }),
      ).rejects.toThrow(messages.errors.invalidPeriod);
    });

    it("RN-08: refuses a period that starts before the unit opens", async () => {
      await expect(create({ startsAt: at("2026-10-26T08:00").toISOString() })).rejects.toThrow(
        messages.errors.outsideOperatingHours,
      );
    });

    it("RN-08: refuses a period that ends after the unit closes", async () => {
      await expect(create({ endsAt: at("2026-10-26T18:20").toISOString() })).rejects.toThrow(
        messages.errors.outsideOperatingHours,
      );
    });

    it("RN-08: refuses a period on a day the unit does not work", async () => {
      await expect(
        create({ startsAt: at("2026-10-25T09:00").toISOString(), endsAt: at("2026-10-25T17:00").toISOString() }),
      ).rejects.toThrow(messages.errors.outsideOperatingHours);
    });

    it("RN-08: follows the operating hours currently set in the business rules", async () => {
      service = await serviceWith({ workStartMinutes: 420 });

      await expect(create({ startsAt: at("2026-10-26T07:00").toISOString() })).resolves.toEqual(
        expect.objectContaining({ startsAt: new Date("2026-10-26T10:00:00.000Z") }),
      );
    });

    it("RF-25: refuses an inactive therapist", async () => {
      prisma.therapists.set(THERAPIST_ID, { id: THERAPIST_ID, user: { status: "INACTIVE" } });

      await expect(create({})).rejects.toThrow(messages.errors.therapistInactive);
    });

    it("RF-25: refuses an inactive room", async () => {
      prisma.rooms.set(ROOM_ID, { id: ROOM_ID, active: false, location: { timezone: TIMEZONE } });

      await expect(create({})).rejects.toThrow(messages.errors.roomInactive);
    });

    it.each([
      ["overlaps its start", "2026-10-26T08:00", "2026-10-26T10:00"],
      ["overlaps its end", "2026-10-26T12:00", "2026-10-26T15:00"],
      ["is contained in it", "2026-10-26T10:00", "2026-10-26T11:00"],
      ["contains it", "2026-10-26T09:00", "2026-10-26T15:00"],
    ])("RN-08: refuses a therapist period that %s", async (_shape, startsAt, endsAt) => {
      service = await serviceWith({ workStartMinutes: 420 });
      prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });

      await expect(
        create({ roomId: OTHER_ROOM_ID, startsAt: at(startsAt).toISOString(), endsAt: at(endsAt).toISOString() }),
      ).rejects.toThrow(messages.errors.scheduleConflictTherapist);
    });

    it("RN-08: accepts a period that starts exactly when the other one ends", async () => {
      prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });

      await expect(
        create({ startsAt: at("2026-10-26T13:00").toISOString(), endsAt: at("2026-10-26T17:00").toISOString() }),
      ).resolves.toEqual(expect.objectContaining({ therapistId: THERAPIST_ID }));
    });

    it("RN-08: accepts a period that ends exactly when the other one starts", async () => {
      prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T13:00"),
        endsAt: at("2026-10-26T17:00"),
      });

      await expect(
        create({ startsAt: at("2026-10-26T09:00").toISOString(), endsAt: at("2026-10-26T13:00").toISOString() }),
      ).resolves.toEqual(expect.objectContaining({ therapistId: THERAPIST_ID }));
    });

    it("RN-08: refuses a room already taken by another therapist", async () => {
      prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T14:00"),
      });

      await expect(
        create({
          therapistId: OTHER_THERAPIST_ID,
          startsAt: at("2026-10-26T13:00").toISOString(),
          endsAt: at("2026-10-26T18:00").toISOString(),
        }),
      ).rejects.toThrow(messages.errors.scheduleConflictRoom);
    });

    it("RN-08: lets another therapist use another room at the same time", async () => {
      prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T17:00"),
      });

      await expect(create({ therapistId: OTHER_THERAPIST_ID, roomId: OTHER_ROOM_ID })).resolves.toEqual(
        expect.objectContaining({ therapistId: OTHER_THERAPIST_ID, roomId: OTHER_ROOM_ID }),
      );
    });
  });

  describe("update", () => {
    it("RN-08: does not treat the period being edited as a conflict with itself", async () => {
      const current = prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });

      const updated = await service.update(ACTOR_ID, current.id, { endsAt: at("2026-10-26T15:00").toISOString() });

      expect(updated.endsAt).toEqual(new Date("2026-10-26T18:00:00.000Z"));
      expect(audit.record).toHaveBeenCalledWith(
        ACTOR_ID,
        "SCHEDULE_SLOT_UPDATED",
        "ScheduleSlot",
        current.id,
        expect.objectContaining({ endsAt: "2026-10-26T18:00:00.000Z" }),
      );
    });

    it("RN-08: refuses moving a period into a room already taken", async () => {
      prisma.seed({
        therapistId: OTHER_THERAPIST_ID,
        roomId: OTHER_ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });
      const current = prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });

      await expect(service.update(ACTOR_ID, current.id, { roomId: OTHER_ROOM_ID })).rejects.toThrow(
        messages.errors.scheduleConflictRoom,
      );
    });

    it("RF-25: answers not found for an unknown period", async () => {
      await expect(service.update(ACTOR_ID, "missing", {})).rejects.toThrow(messages.errors.scheduleNotFound);
    });
  });

  describe("remove", () => {
    it("RF-25: removes the period and audits what was removed", async () => {
      const current = prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T13:00"),
      });

      await service.remove(ACTOR_ID, current.id);

      expect(prisma.slots).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(ACTOR_ID, "SCHEDULE_SLOT_DELETED", "ScheduleSlot", current.id, {
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: "2026-10-26T12:00:00.000Z",
        endsAt: "2026-10-26T16:00:00.000Z",
      });
    });
  });

  describe("list", () => {
    it("RF-25: lists periods in chronological order", async () => {
      const afternoon = prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-26T14:00"),
        endsAt: at("2026-10-26T17:00"),
      });
      const nextDay = prisma.seed({
        therapistId: THERAPIST_ID,
        roomId: ROOM_ID,
        startsAt: at("2026-10-27T09:00"),
        endsAt: at("2026-10-27T12:00"),
      });
      const morning = prisma.seed({
        therapistId: OTHER_THERAPIST_ID,
        roomId: OTHER_ROOM_ID,
        startsAt: at("2026-10-26T09:00"),
        endsAt: at("2026-10-26T12:00"),
      });

      const listed = await service.list({ startDate: "2026-10-26", endDate: "2026-10-27" });

      expect(listed.map((slot) => slot.id)).toEqual([morning.id, afternoon.id, nextDay.id]);
    });

    it("RF-25: refuses an interval whose end date comes before its start date", async () => {
      await expect(service.list({ startDate: "2026-10-27", endDate: "2026-10-26" })).rejects.toThrow(
        messages.errors.invalidPeriod,
      );
    });

    it("RF-25: refuses a listing without a date or a date interval", async () => {
      await expect(service.list({ therapistId: THERAPIST_ID })).rejects.toThrow(messages.errors.invalidPeriod);
    });

    it("RF-25: refuses an interval missing one of its dates", async () => {
      await expect(service.list({ startDate: "2026-10-27" })).rejects.toThrow(messages.errors.invalidPeriod);
    });
  });
});
