import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { BUSINESS_RULES_REPOSITORY, BusinessRulesRepository } from "../src/business-rules/business-rules.repository";
import { BusinessRulesService } from "../src/business-rules/business-rules.service";
import { BusinessRules } from "../src/config/business-rules.config";
import { messages } from "../src/messages/catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./support/create-test-app";
import { truncateAllTables } from "./support/test-database";

const TEST_ENVIRONMENT_RULES: BusinessRules = {
  bookingMinNoticeMinutes: 60,
  cancellationMinNoticeMinutes: 120,
  lateArrivalToleranceMinutes: 10,
  checkInEarlyMinutes: 15,
  reminderLeadMinutes: 1440,
  reminderConfirmationToleranceMinutes: 720,
  waitlistAcceptanceMinutes: 30,
  sessionDurationMinutes: 20,
  slotStepMinutes: 20,
  bookingHorizonDays: 21,
  maxActiveBookingsPerEmployee: 1,
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 540,
  lunchStartMinutes: 720,
  lunchEndMinutes: 780,
  workEndMinutes: 1080,
};
const SECOND_ROW_ID = 2;
const ELEVEN_AM = 660;
const PATCH_REACHES_DATABASE_MS = 300;

describe("Business rules table (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: BusinessRulesRepository;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    repository = app.get(BUSINESS_RULES_REPOSITORY);
  });

  beforeEach(async () => {
    await truncateAllTables(prisma);
  });

  afterAll(async () => {
    await truncateAllTables(prisma);
    await app.close();
  });

  const startAnotherApp = async () => {
    const started = await createTestApp();
    const current = started.app.get(BusinessRulesService).current();
    await started.app.close();
    return current;
  };

  it("RF-27: stores the test environment values when the application starts on an empty database", async () => {
    const current = await startAnotherApp();

    expect(current).toEqual(TEST_ENVIRONMENT_RULES);
    expect(await repository.findCurrent()).toEqual(TEST_ENVIRONMENT_RULES);
  });

  it("RF-27: keeps the stored value when the environment says otherwise", async () => {
    await repository.insertInitialIfMissing({ ...TEST_ENVIRONMENT_RULES, sessionDurationMinutes: 30 });

    const current = await startAnotherApp();

    expect(current.sessionDurationMinutes).toBe(30);
  });

  it("RF-27: allows a single row of business rules", async () => {
    await repository.insertInitialIfMissing(TEST_ENVIRONMENT_RULES);

    const secondRow = prisma.businessRules.create({
      data: { ...TEST_ENVIRONMENT_RULES, workDays: [...TEST_ENVIRONMENT_RULES.workDays], id: SECOND_ROW_ID },
    });

    await expect(secondRow).rejects.toThrow(/business_rules_single_row/);
    expect(await prisma.businessRules.count()).toBe(1);
  });

  it("RF-27: two concurrent initial inserts keep a single row without failing", async () => {
    const otherRules = { ...TEST_ENVIRONMENT_RULES, sessionDurationMinutes: 30 };

    const inserts = Promise.all([
      repository.insertInitialIfMissing(TEST_ENVIRONMENT_RULES),
      repository.insertInitialIfMissing(otherRules),
    ]);

    await expect(inserts).resolves.toBeDefined();
    expect(await prisma.businessRules.count()).toBe(1);
  });

  it("RF-27: does not overwrite the stored row on a later initial insert", async () => {
    await repository.insertInitialIfMissing({ ...TEST_ENVIRONMENT_RULES, sessionDurationMinutes: 30 });

    await repository.insertInitialIfMissing(TEST_ENVIRONMENT_RULES);

    expect((await repository.findCurrent())?.sessionDurationMinutes).toBe(30);
  });

  describe("editing by HR", () => {
    let hrId: string;

    const patchRule = (key: string, value: unknown) =>
      request(app.getHttpServer()).patch(`/api/business-rules/${key}`).set("x-user-id", hrId).send({ value });

    beforeEach(async () => {
      await repository.insertInitialIfMissing(TEST_ENVIRONMENT_RULES);
      await app.get(BusinessRulesService).onModuleInit();
      hrId = (await prisma.user.create({ data: { email: "hr@example.com", name: "Helena Rocha", role: "HR" } })).id;
    });

    it("TK-03.07 RF-27: saves the new value, audits both values and serves it without restarting", async () => {
      const response = await patchRule("SESSION_DURATION_MINUTES", "30").expect(200);

      expect(response.body).toEqual({
        key: "SESSION_DURATION_MINUTES",
        value: "30",
        type: "MINUTES",
        description: expect.any(String),
      });
      expect((await repository.findCurrent())?.sessionDurationMinutes).toBe(30);
      expect(app.get(BusinessRulesService).current().sessionDurationMinutes).toBe(30);
      const events = await prisma.auditEvent.findMany();
      expect(events).toEqual([
        expect.objectContaining({
          actorId: hrId,
          action: "BUSINESS_RULE_UPDATED",
          entityType: "BusinessRules",
          entityId: "SESSION_DURATION_MINUTES",
          data: { previousValue: "20", newValue: "30" },
        }),
      ]);
    });

    it("TK-03.07 RF-27: lists every parameter with its key, current value, type and description", async () => {
      await patchRule("LUNCH_START", "12:30").expect(200);

      const response = await request(app.getHttpServer()).get("/api/business-rules").set("x-user-id", hrId).expect(200);

      expect(
        response.body.map(({ key, value, type }: { key: string; value: string; type: string }) => [key, value, type]),
      ).toEqual([
        ["BOOKING_MIN_NOTICE_MINUTES", "60", "MINUTES"],
        ["CANCELLATION_MIN_NOTICE_MINUTES", "120", "MINUTES"],
        ["LATE_ARRIVAL_TOLERANCE_MINUTES", "10", "MINUTES"],
        ["CHECK_IN_EARLY_MINUTES", "15", "MINUTES"],
        ["REMINDER_LEAD_MINUTES", "1440", "MINUTES"],
        ["REMINDER_CONFIRMATION_TOLERANCE_MINUTES", "720", "MINUTES"],
        ["WAITLIST_ACCEPTANCE_MINUTES", "30", "MINUTES"],
        ["SESSION_DURATION_MINUTES", "20", "MINUTES"],
        ["SLOT_STEP_MINUTES", "20", "MINUTES"],
        ["BOOKING_HORIZON_DAYS", "21", "DAYS"],
        ["MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE", "1", "COUNT"],
        ["WORK_DAYS", "1,2,3,4,5", "WEEKDAYS"],
        ["WORK_START", "09:00", "TIME_OF_DAY"],
        ["LUNCH_START", "12:30", "TIME_OF_DAY"],
        ["LUNCH_END", "13:00", "TIME_OF_DAY"],
        ["WORK_END", "18:00", "TIME_OF_DAY"],
      ]);
      expect(response.body).toContainEqual({
        key: "SESSION_DURATION_MINUTES",
        value: "20",
        type: "MINUTES",
        description: "Duração de cada sessão, em minutos.",
      });
    });

    const expectNothingChanged = async () => {
      expect(await repository.findCurrent()).toEqual(TEST_ENVIRONMENT_RULES);
      expect(app.get(BusinessRulesService).current()).toEqual(TEST_ENVIRONMENT_RULES);
      expect(await prisma.auditEvent.count()).toBe(0);
    };

    it.each([
      ["SESSION_DURATION_MINUTES", "121", "A duração da sessão deve ficar entre 10 e 120 minutos."],
      ["SESSION_DURATION_MINUTES", "9", "A duração da sessão deve ficar entre 10 e 120 minutos."],
      ["BOOKING_HORIZON_DAYS", "0", "A janela de agendamento deve ficar entre 1 e 90 dias."],
      ["SLOT_STEP_MINUTES", "0", "O intervalo entre horários deve ser um número inteiro maior que zero."],
      [
        "BOOKING_MIN_NOTICE_MINUTES",
        "abc",
        "A antecedência mínima para agendar deve ser um número inteiro igual ou maior que zero.",
      ],
      ["WORK_START", "9h", "O início do expediente deve estar no formato HH:MM, por exemplo 09:00."],
      ["WORK_DAYS", "1,8", "Os dias de funcionamento devem ir de 1 (segunda) a 7 (domingo), por exemplo 1,2,3,4,5."],
    ])(
      "TK-03.07 RF-27: refuses %s = %p with invalidBusinessRuleValue, naming the parameter, and changes nothing",
      async (key, value, message) => {
        const response = await patchRule(key, value).expect(400);

        expect(response.body.message).toBe(message);
        await expectNothingChanged();
      },
    );

    it.each([
      ["LUNCH_START", "08:30", "O início do almoço deve ser depois do início do expediente."],
      ["LUNCH_START", "18:30", "O início do almoço deve ser antes do fim do expediente."],
      ["LUNCH_END", "11:30", "O fim do almoço não pode ser antes do início do almoço."],
      ["WORK_END", "12:30", "O fim do expediente deve ser depois do fim do almoço."],
    ])(
      "TK-03.07 RN-08: refuses %s = %p that leaves the working hours out of order and changes nothing",
      async (key, value, message) => {
        const response = await patchRule(key, value).expect(400);

        expect(response.body.message).toBe(message);
        await expectNothingChanged();
      },
    );

    it("TK-03.07 RF-27: refuses a value that is not text and changes nothing", async () => {
      const response = await patchRule("SESSION_DURATION_MINUTES", 30).expect(400);

      expect(response.body.message).toEqual([messages.errors.invalidBusinessRuleValue]);
      await expectNothingChanged();
    });

    it("TK-03.07 RF-27: answers 404 for a parameter that does not exist", async () => {
      const response = await patchRule("COFFEE_BREAK_MINUTES", "10").expect(404);

      expect(response.body.message).toBe(messages.errors.businessRuleNotFound);
      await expectNothingChanged();
    });

    it("TK-03.07 RN-08: validates against a concurrent change instead of overwriting it", async () => {
      let signalRowLocked!: () => void;
      let releaseRow!: () => void;
      const rowLocked = new Promise<void>((resolve) => (signalRowLocked = resolve));
      const rowReleased = new Promise<void>((resolve) => (releaseRow = resolve));
      const concurrentChange = prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM business_rules FOR UPDATE`;
        await transaction.businessRules.updateMany({ data: { workStartMinutes: ELEVEN_AM } });
        signalRowLocked();
        await rowReleased;
      });
      await rowLocked;

      const pendingPatch = patchRule("LUNCH_START", "10:00").then((response) => response);
      await new Promise((resolve) => setTimeout(resolve, PATCH_REACHES_DATABASE_MS));
      releaseRow();
      await concurrentChange;
      const response = await pendingPatch;

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("O início do almoço deve ser depois do início do expediente.");
      const stored = await repository.findCurrent();
      expect(stored).toEqual({ ...TEST_ENVIRONMENT_RULES, workStartMinutes: ELEVEN_AM });
      expect(await prisma.auditEvent.count()).toBe(0);
    });

    it("TK-03.07 RF-27: a restarted application uses the edited value", async () => {
      await patchRule("SESSION_DURATION_MINUTES", "30").expect(200);

      const current = await startAnotherApp();

      expect(current.sessionDurationMinutes).toBe(30);
    });
  });
});
