import { Test } from "@nestjs/testing";
import { BusinessRules, businessRulesConfig } from "../config/business-rules.config";
import { BUSINESS_RULES_REPOSITORY, BusinessRulesRevision } from "./business-rules.repository";
import { BusinessRulesService } from "./business-rules.service";
import { InMemoryBusinessRulesRepository, TEST_BUSINESS_RULES } from "./business-rules.testing";

const ACTOR_ID = "5d1c7e0a-3b2f-4a6d-9c8e-1f0a2b3c4d5e";
const LATE_ANSWER_MS = 20;

class SlowFirstAnswerRepository extends InMemoryBusinessRulesRepository {
  private revisions = 0;

  async revise(buildRevision: (stored: BusinessRules) => BusinessRulesRevision): Promise<BusinessRules> {
    const saved = await super.revise(buildRevision);
    this.revisions += 1;
    if (this.revisions === 1) await new Promise((resolve) => setTimeout(resolve, LATE_ANSWER_MS));
    return saved;
  }
}

async function startBusinessRules(repository: InMemoryBusinessRulesRepository) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      BusinessRulesService,
      { provide: businessRulesConfig.KEY, useValue: TEST_BUSINESS_RULES },
      { provide: BUSINESS_RULES_REPOSITORY, useValue: repository },
    ],
  }).compile();
  await moduleRef.init();
  return moduleRef.get(BusinessRulesService);
}

describe("BusinessRulesService", () => {
  it("RF-27: stores the environment values in an empty database and serves them", async () => {
    const repository = new InMemoryBusinessRulesRepository();

    const businessRules = await startBusinessRules(repository);

    expect(await repository.findCurrent()).toEqual(TEST_BUSINESS_RULES);
    expect(businessRules.current()).toEqual(TEST_BUSINESS_RULES);
  });

  it("RF-27: serves the stored values instead of the environment ones", async () => {
    const storedRules = { ...TEST_BUSINESS_RULES, sessionDurationMinutes: 30 };
    const repository = new InMemoryBusinessRulesRepository(storedRules);

    const businessRules = await startBusinessRules(repository);

    expect(businessRules.current().sessionDurationMinutes).toBe(30);
    expect(await repository.findCurrent()).toEqual(storedRules);
  });

  it("RF-27: serves later reads from memory without querying the repository again", async () => {
    const repository = new InMemoryBusinessRulesRepository();
    const businessRules = await startBusinessRules(repository);
    const findCurrent = jest.spyOn(repository, "findCurrent");
    const insertInitialIfMissing = jest.spyOn(repository, "insertInitialIfMissing");

    businessRules.current();
    businessRules.current();
    businessRules.current();

    expect(findCurrent).not.toHaveBeenCalled();
    expect(insertInitialIfMissing).not.toHaveBeenCalled();
  });

  it("RN-08: refuses to start when the stored lunch break starts after working hours, naming the parameter", async () => {
    const repository = new InMemoryBusinessRulesRepository({ ...TEST_BUSINESS_RULES, lunchStartMinutes: 1140 });

    await expect(startBusinessRules(repository)).rejects.toThrow("LUNCH_START deve ser antes de WORK_END.");
  });

  it("TK-03.07 RF-27: serves the last saved set when two edits run at once and the first answers late", async () => {
    const repository = new SlowFirstAnswerRepository(TEST_BUSINESS_RULES);
    const businessRules = await startBusinessRules(repository);

    await Promise.all([
      businessRules.update(ACTOR_ID, "SESSION_DURATION_MINUTES", "30"),
      businessRules.update(ACTOR_ID, "BOOKING_HORIZON_DAYS", "14"),
    ]);

    expect(businessRules.current()).toEqual(await repository.findCurrent());
    expect(businessRules.current()).toMatchObject({ sessionDurationMinutes: 30, bookingHorizonDays: 14 });
  });

  it.each([
    ["SLOT_STEP_MINUTES", { slotStepMinutes: 0 }],
    ["BOOKING_MIN_NOTICE_MINUTES", { bookingMinNoticeMinutes: -1 }],
    ["WORK_DAYS", { workDays: [0, 1] }],
    ["WORK_END", { workEndMinutes: 1440 }],
  ])("RF-27: refuses to start with an impossible stored %s", async (parameter, storedOverride) => {
    const repository = new InMemoryBusinessRulesRepository({ ...TEST_BUSINESS_RULES, ...storedOverride });

    await expect(startBusinessRules(repository)).rejects.toThrow(parameter);
  });
});
