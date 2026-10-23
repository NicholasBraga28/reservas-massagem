import { validateEnvironment } from "./env.validation";

const validEnvironment = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  PORT: "3000",
  AUTH_MODE: "header",
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

describe("validateEnvironment", () => {
  it("accepts a complete environment", () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({ DATABASE_URL: validEnvironment.DATABASE_URL });
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => validateEnvironment({ ...validEnvironment, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("rejects a port outside the valid range", () => {
    expect(() => validateEnvironment({ ...validEnvironment, PORT: "70000" })).toThrow(/PORT/);
  });

  it("rejects an unknown AUTH_MODE", () => {
    expect(() => validateEnvironment({ ...validEnvironment, AUTH_MODE: "password" })).toThrow(/AUTH_MODE/);
  });

  it("requires GOOGLE_CLIENT_ID when AUTH_MODE is google", () => {
    expect(() => validateEnvironment({ ...validEnvironment, AUTH_MODE: "google" })).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("rejects an invalid business rule parameter at startup", () => {
    expect(() => validateEnvironment({ ...validEnvironment, WORK_END: "25:00" })).toThrow(/WORK_END/);
  });
});
