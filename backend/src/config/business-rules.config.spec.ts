import {
  formatBusinessRuleValue,
  InvalidBusinessRulesError,
  parseBusinessRules,
  withBusinessRuleValue,
} from "./business-rules.config";

const validEnvironment = {
  BOOKING_MIN_NOTICE_MINUTES: "60",
  CANCELLATION_MIN_NOTICE_MINUTES: "120",
  LATE_ARRIVAL_TOLERANCE_MINUTES: "10",
  CHECK_IN_EARLY_MINUTES: "15",
  REMINDER_LEAD_MINUTES: "1440",
  REMINDER_CONFIRMATION_TOLERANCE_MINUTES: "720",
  WAITLIST_ACCEPTANCE_MINUTES: "30",
  SESSION_DURATION_MINUTES: "20",
  SLOT_STEP_MINUTES: "20",
  BOOKING_HORIZON_DAYS: "21",
  MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE: "1",
  WORK_DAYS: "1,2,3,4,5",
  WORK_START: "09:00",
  LUNCH_START: "12:00",
  LUNCH_END: "13:00",
  WORK_END: "18:00",
};

describe("parseBusinessRules", () => {
  it("parses every business rule parameter from the environment", () => {
    expect(parseBusinessRules(validEnvironment)).toEqual({
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
    });
  });

  it("rejects a missing parameter, naming it", () => {
    expect(() => parseBusinessRules({ ...validEnvironment, SESSION_DURATION_MINUTES: undefined })).toThrow(
      /SESSION_DURATION_MINUTES/,
    );
  });

  it.each(["-1", "1.5", "abc"])("rejects %p as a number of minutes", (value) => {
    expect(() => parseBusinessRules({ ...validEnvironment, BOOKING_MIN_NOTICE_MINUTES: value })).toThrow(
      InvalidBusinessRulesError,
    );
  });

  it("RN-05: rejects a session duration of zero minutes", () => {
    expect(() => parseBusinessRules({ ...validEnvironment, SESSION_DURATION_MINUTES: "0" })).toThrow(
      /SESSION_DURATION_MINUTES/,
    );
  });

  it.each([
    ["SESSION_DURATION_MINUTES", "9"],
    ["SESSION_DURATION_MINUTES", "121"],
    ["BOOKING_HORIZON_DAYS", "91"],
  ])("RF-27: rejects %s = %p outside its limits, naming the limits", (parameter, value) => {
    expect(() => parseBusinessRules({ ...validEnvironment, [parameter]: value })).toThrow(
      new RegExp(`${parameter} deve ficar entre \\d+ e \\d+`),
    );
  });

  it.each([
    ["SESSION_DURATION_MINUTES", "10"],
    ["SESSION_DURATION_MINUTES", "120"],
    ["BOOKING_HORIZON_DAYS", "1"],
    ["BOOKING_HORIZON_DAYS", "90"],
  ])("RF-27: accepts %s = %p on the edge of its limits", (parameter, value) => {
    expect(() => parseBusinessRules({ ...validEnvironment, [parameter]: value })).not.toThrow();
  });

  it.each([
    ["sessionDurationMinutes", "30"],
    ["workStartMinutes", "08:05"],
    ["workDays", "1,3,5"],
  ] as const)("TK-03.07 RF-27: formats %s back to the text it was given (%p)", (rule, value) => {
    const rules = withBusinessRuleValue(parseBusinessRules(validEnvironment), rule, value);

    expect(formatBusinessRuleValue(rules, rule)).toBe(value);
  });

  it.each(["9h", "9:00", "24:00", "12:60"])("RN-08: rejects %p as a time of day", (value) => {
    expect(() => parseBusinessRules({ ...validEnvironment, WORK_START: value })).toThrow(/WORK_START/);
  });

  it.each(["0,1", "1,8", "", "seg"])("RN-08: rejects %p as working days", (value) => {
    expect(() => parseBusinessRules({ ...validEnvironment, WORK_DAYS: value })).toThrow(/WORK_DAYS/);
  });

  it("RN-08: rejects a lunch break outside working hours", () => {
    expect(() => parseBusinessRules({ ...validEnvironment, LUNCH_START: "08:00" })).toThrow(InvalidBusinessRulesError);
  });

  it("RN-08: accepts a day without lunch break when lunch start equals lunch end", () => {
    const rules = parseBusinessRules({ ...validEnvironment, LUNCH_START: "12:00", LUNCH_END: "12:00" });
    expect(rules.lunchStartMinutes).toBe(rules.lunchEndMinutes);
  });
});
