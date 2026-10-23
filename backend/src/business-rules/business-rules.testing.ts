import { BusinessRules } from "../config/business-rules.config";
import {
  BusinessRulesRepository,
  BusinessRulesRevision,
  BusinessRulesRowMissingError,
} from "./business-rules.repository";
import { BusinessRulesService } from "./business-rules.service";

export const TEST_BUSINESS_RULES: BusinessRules = {
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

export function businessRulesServiceWith(
  overrides: Partial<BusinessRules> = {},
): Pick<BusinessRulesService, "current"> {
  const rules: BusinessRules = { ...TEST_BUSINESS_RULES, ...overrides };
  return { current: () => rules };
}

export class InMemoryBusinessRulesRepository implements BusinessRulesRepository {
  constructor(private stored: BusinessRules | null = null) {}

  async findCurrent(): Promise<BusinessRules | null> {
    return this.stored;
  }

  async insertInitialIfMissing(initialRules: BusinessRules): Promise<void> {
    this.stored ??= initialRules;
  }

  async revise(buildRevision: (stored: BusinessRules) => BusinessRulesRevision): Promise<BusinessRules> {
    if (!this.stored) throw new BusinessRulesRowMissingError("A linha de parâmetros de negócio não existe.");
    this.stored = buildRevision(this.stored).rules;
    return this.stored;
  }
}
