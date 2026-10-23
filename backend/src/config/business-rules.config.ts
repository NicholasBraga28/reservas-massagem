import { registerAs } from "@nestjs/config";

type IsoWeekday = number;
type MinutesSinceMidnight = number;

export type BusinessRules = Readonly<{
  bookingMinNoticeMinutes: number;
  cancellationMinNoticeMinutes: number;
  lateArrivalToleranceMinutes: number;
  checkInEarlyMinutes: number;
  reminderLeadMinutes: number;
  reminderConfirmationToleranceMinutes: number;
  waitlistAcceptanceMinutes: number;
  sessionDurationMinutes: number;
  slotStepMinutes: number;
  bookingHorizonDays: number;
  maxActiveBookingsPerEmployee: number;
  workDays: readonly IsoWeekday[];
  workStartMinutes: MinutesSinceMidnight;
  lunchStartMinutes: MinutesSinceMidnight;
  lunchEndMinutes: MinutesSinceMidnight;
  workEndMinutes: MinutesSinceMidnight;
}>;

export type BusinessRuleName = keyof BusinessRules;
export type BusinessRuleType = "MINUTES" | "DAYS" | "COUNT" | "TIME_OF_DAY" | "WEEKDAYS";
type BusinessRuleValue = BusinessRules[BusinessRuleName];
type Environment = Record<string, string | undefined>;

const BUSINESS_RULE_DEFINITIONS: Readonly<
  Record<BusinessRuleName, Readonly<{ parameter: string; type: BusinessRuleType }>>
> = {
  bookingMinNoticeMinutes: { parameter: "BOOKING_MIN_NOTICE_MINUTES", type: "MINUTES" },
  cancellationMinNoticeMinutes: { parameter: "CANCELLATION_MIN_NOTICE_MINUTES", type: "MINUTES" },
  lateArrivalToleranceMinutes: { parameter: "LATE_ARRIVAL_TOLERANCE_MINUTES", type: "MINUTES" },
  checkInEarlyMinutes: { parameter: "CHECK_IN_EARLY_MINUTES", type: "MINUTES" },
  reminderLeadMinutes: { parameter: "REMINDER_LEAD_MINUTES", type: "MINUTES" },
  reminderConfirmationToleranceMinutes: { parameter: "REMINDER_CONFIRMATION_TOLERANCE_MINUTES", type: "MINUTES" },
  waitlistAcceptanceMinutes: { parameter: "WAITLIST_ACCEPTANCE_MINUTES", type: "MINUTES" },
  sessionDurationMinutes: { parameter: "SESSION_DURATION_MINUTES", type: "MINUTES" },
  slotStepMinutes: { parameter: "SLOT_STEP_MINUTES", type: "MINUTES" },
  bookingHorizonDays: { parameter: "BOOKING_HORIZON_DAYS", type: "DAYS" },
  maxActiveBookingsPerEmployee: { parameter: "MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE", type: "COUNT" },
  workDays: { parameter: "WORK_DAYS", type: "WEEKDAYS" },
  workStartMinutes: { parameter: "WORK_START", type: "TIME_OF_DAY" },
  lunchStartMinutes: { parameter: "LUNCH_START", type: "TIME_OF_DAY" },
  lunchEndMinutes: { parameter: "LUNCH_END", type: "TIME_OF_DAY" },
  workEndMinutes: { parameter: "WORK_END", type: "TIME_OF_DAY" },
};

export const BUSINESS_RULE_NAMES = Object.keys(BUSINESS_RULE_DEFINITIONS) as BusinessRuleName[];

const NON_NEGATIVE_RULES = [
  "bookingMinNoticeMinutes",
  "cancellationMinNoticeMinutes",
  "lateArrivalToleranceMinutes",
  "checkInEarlyMinutes",
  "reminderLeadMinutes",
  "reminderConfirmationToleranceMinutes",
  "waitlistAcceptanceMinutes",
] as const;
const POSITIVE_RULES = [
  "sessionDurationMinutes",
  "slotStepMinutes",
  "bookingHorizonDays",
  "maxActiveBookingsPerEmployee",
] as const;
const TIME_OF_DAY_RULES = ["workStartMinutes", "lunchStartMinutes", "lunchEndMinutes", "workEndMinutes"] as const;
const RULE_LIMITS = [
  { rule: "sessionDurationMinutes", min: 10, max: 120 },
  { rule: "bookingHorizonDays", min: 1, max: 90 },
] as const;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;
const FIRST_ISO_WEEKDAY = 1;
const LAST_ISO_WEEKDAY = 7;

type SingleRuleViolationKind =
  "MISSING" | "NOT_NON_NEGATIVE_INTEGER" | "NOT_POSITIVE" | "NOT_TIME_OF_DAY" | "OUTSIDE_DAY" | "NOT_WEEKDAYS";

export type BusinessRuleViolation = Readonly<
  | { kind: SingleRuleViolationKind; rule: BusinessRuleName }
  | { kind: "OUT_OF_LIMITS"; rule: BusinessRuleName; min: number; max: number }
  | { kind: "NOT_AFTER" | "NOT_BEFORE" | "BEFORE"; rule: BusinessRuleName; other: BusinessRuleName }
>;

export const parameterName = (rule: BusinessRuleName) => BUSINESS_RULE_DEFINITIONS[rule].parameter;

export const businessRuleType = (rule: BusinessRuleName) => BUSINESS_RULE_DEFINITIONS[rule].type;

export const ruleForParameter = (parameter: string): BusinessRuleName | undefined =>
  BUSINESS_RULE_NAMES.find((rule) => parameterName(rule) === parameter);

function environmentMessage(violation: BusinessRuleViolation): string {
  const parameter = parameterName(violation.rule);
  switch (violation.kind) {
    case "MISSING":
      return `${parameter} precisa ser definido conforme as regras de negócio.`;
    case "NOT_NON_NEGATIVE_INTEGER":
      return `${parameter} deve ser um número inteiro não negativo.`;
    case "NOT_POSITIVE":
      return `${parameter} deve ser maior que zero.`;
    case "NOT_TIME_OF_DAY":
      return `${parameter} deve estar no formato HH:MM, por exemplo 09:00.`;
    case "OUTSIDE_DAY":
      return `${parameter} deve ser um horário entre 00:00 e 23:59.`;
    case "NOT_WEEKDAYS":
      return `${parameter} deve listar dias de 1 (segunda) a 7 (domingo), por exemplo 1,2,3,4,5.`;
    case "OUT_OF_LIMITS":
      return `${parameter} deve ficar entre ${violation.min} e ${violation.max}.`;
    case "NOT_AFTER":
      return `${parameter} deve ser depois de ${parameterName(violation.other)}.`;
    case "NOT_BEFORE":
      return `${parameter} deve ser antes de ${parameterName(violation.other)}.`;
    case "BEFORE":
      return `${parameter} não pode ser antes de ${parameterName(violation.other)}.`;
  }
}

export class InvalidBusinessRulesError extends Error {
  constructor(
    readonly violation: BusinessRuleViolation,
    message = environmentMessage(violation),
  ) {
    super(message);
  }
}

const violated = (kind: SingleRuleViolationKind, rule: BusinessRuleName) =>
  new InvalidBusinessRulesError({ kind, rule });

function readRequired(env: Environment, rule: BusinessRuleName): string {
  const raw = env[parameterName(rule)]?.trim();
  if (!raw) throw violated("MISSING", rule);
  return raw;
}

function readNonNegativeInteger(env: Environment, rule: BusinessRuleName): number {
  const raw = readRequired(env, rule);
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(raw)) throw violated("NOT_NON_NEGATIVE_INTEGER", rule);
  return Number(raw);
}

function readTimeOfDay(env: Environment, rule: BusinessRuleName): MinutesSinceMidnight {
  const match = TIME_OF_DAY_PATTERN.exec(readRequired(env, rule));
  if (!match) throw violated("NOT_TIME_OF_DAY", rule);
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

function readWeekdays(env: Environment, rule: BusinessRuleName): IsoWeekday[] {
  const days = readRequired(env, rule)
    .split(",")
    .map((value) => value.trim());
  if (!days.every((value) => NON_NEGATIVE_INTEGER_PATTERN.test(value))) throw violated("NOT_WEEKDAYS", rule);
  return [...new Set(days.map(Number))].sort((a, b) => a - b);
}

function readValue(env: Environment, rule: BusinessRuleName): BusinessRuleValue {
  const type = businessRuleType(rule);
  if (type === "TIME_OF_DAY") return readTimeOfDay(env, rule);
  if (type === "WEEKDAYS") return readWeekdays(env, rule);
  return readNonNegativeInteger(env, rule);
}

export function withBusinessRuleValue(rules: BusinessRules, rule: BusinessRuleName, raw: string): BusinessRules {
  return { ...rules, [rule]: readValue({ [parameterName(rule)]: raw }, rule) };
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatTimeOfDay = (minutes: MinutesSinceMidnight) =>
  `${twoDigits(Math.floor(minutes / MINUTES_PER_HOUR))}:${twoDigits(minutes % MINUTES_PER_HOUR)}`;

export function formatBusinessRuleValue(rules: BusinessRules, rule: BusinessRuleName): string {
  const value = rules[rule];
  if (typeof value !== "number") return value.join(",");
  return businessRuleType(rule) === "TIME_OF_DAY" ? formatTimeOfDay(value) : String(value);
}

function assertWithinRanges(rules: BusinessRules): void {
  for (const { rule, min, max } of RULE_LIMITS) {
    if (rules[rule] < min || rules[rule] > max)
      throw new InvalidBusinessRulesError({ kind: "OUT_OF_LIMITS", rule, min, max });
  }
  for (const rule of NON_NEGATIVE_RULES) {
    if (!Number.isInteger(rules[rule]) || rules[rule] < 0) throw violated("NOT_NON_NEGATIVE_INTEGER", rule);
  }
  for (const rule of POSITIVE_RULES) {
    if (!Number.isInteger(rules[rule]) || rules[rule] <= 0) throw violated("NOT_POSITIVE", rule);
  }
  for (const rule of TIME_OF_DAY_RULES) {
    if (!Number.isInteger(rules[rule]) || rules[rule] < 0 || rules[rule] >= MINUTES_PER_DAY) {
      throw violated("OUTSIDE_DAY", rule);
    }
  }
  const isIsoWeekday = (day: number) => Number.isInteger(day) && day >= FIRST_ISO_WEEKDAY && day <= LAST_ISO_WEEKDAY;
  if (rules.workDays.length === 0 || !rules.workDays.every(isIsoWeekday)) throw violated("NOT_WEEKDAYS", "workDays");
}

function assertComesAfter(later: BusinessRuleName, earlier: BusinessRuleName, rules: BusinessRules): void {
  if (rules[later] <= rules[earlier]) {
    throw new InvalidBusinessRulesError({ kind: "NOT_AFTER", rule: later, other: earlier });
  }
}

function assertComesBefore(earlier: BusinessRuleName, later: BusinessRuleName, rules: BusinessRules): void {
  if (rules[earlier] >= rules[later]) {
    throw new InvalidBusinessRulesError({ kind: "NOT_BEFORE", rule: earlier, other: later });
  }
}

function assertOrderedWorkingHours(rules: BusinessRules): void {
  assertComesAfter("lunchStartMinutes", "workStartMinutes", rules);
  assertComesBefore("lunchStartMinutes", "workEndMinutes", rules);
  if (rules.lunchEndMinutes < rules.lunchStartMinutes) {
    throw new InvalidBusinessRulesError({ kind: "BEFORE", rule: "lunchEndMinutes", other: "lunchStartMinutes" });
  }
  assertComesAfter("workEndMinutes", "lunchEndMinutes", rules);
}

export function assertConsistentBusinessRules(rules: BusinessRules): void {
  assertWithinRanges(rules);
  assertOrderedWorkingHours(rules);
}

export function parseBusinessRules(env: Environment): BusinessRules {
  const rules: BusinessRules = {
    bookingMinNoticeMinutes: readNonNegativeInteger(env, "bookingMinNoticeMinutes"),
    cancellationMinNoticeMinutes: readNonNegativeInteger(env, "cancellationMinNoticeMinutes"),
    lateArrivalToleranceMinutes: readNonNegativeInteger(env, "lateArrivalToleranceMinutes"),
    checkInEarlyMinutes: readNonNegativeInteger(env, "checkInEarlyMinutes"),
    reminderLeadMinutes: readNonNegativeInteger(env, "reminderLeadMinutes"),
    reminderConfirmationToleranceMinutes: readNonNegativeInteger(env, "reminderConfirmationToleranceMinutes"),
    waitlistAcceptanceMinutes: readNonNegativeInteger(env, "waitlistAcceptanceMinutes"),
    sessionDurationMinutes: readNonNegativeInteger(env, "sessionDurationMinutes"),
    slotStepMinutes: readNonNegativeInteger(env, "slotStepMinutes"),
    bookingHorizonDays: readNonNegativeInteger(env, "bookingHorizonDays"),
    maxActiveBookingsPerEmployee: readNonNegativeInteger(env, "maxActiveBookingsPerEmployee"),
    workDays: readWeekdays(env, "workDays"),
    workStartMinutes: readTimeOfDay(env, "workStartMinutes"),
    lunchStartMinutes: readTimeOfDay(env, "lunchStartMinutes"),
    lunchEndMinutes: readTimeOfDay(env, "lunchEndMinutes"),
    workEndMinutes: readTimeOfDay(env, "workEndMinutes"),
  };
  assertConsistentBusinessRules(rules);
  return rules;
}

export const businessRulesConfig = registerAs("businessRules", () => parseBusinessRules(process.env));
