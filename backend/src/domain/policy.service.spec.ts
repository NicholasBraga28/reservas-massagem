import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import { businessRulesServiceWith } from "../business-rules/business-rules.testing";
import { CLOCK } from "../common/clock/clock";
import { FakeClock } from "../common/clock/fake-clock";
import { BusinessRules } from "../config/business-rules.config";
import { PolicyService } from "./policy.service";

const timezone = "America/Sao_Paulo";
const at = (value: string) => new Date(value);

async function createPolicy(now: string, overrides: Partial<BusinessRules> = {}) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PolicyService,
      { provide: BusinessRulesService, useValue: businessRulesServiceWith(overrides) },
      { provide: CLOCK, useValue: new FakeClock(at(now)) },
    ],
  }).compile();
  return moduleRef.get(PolicyService);
}

describe("PolicyService", () => {
  it("rejects a period without positive duration", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z");
    expect(() => policy.assertPeriod(at("2026-10-03T12:00:00Z"), at("2026-10-03T12:00:00Z"))).toThrow(
      BadRequestException,
    );
  });

  it("RN-01: accepts a booking exactly at the minimum notice", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z");
    expect(() => policy.assertCanBook(at("2026-10-03T13:00:00Z"))).not.toThrow();
  });

  it("RN-01: rejects a booking before the minimum notice", async () => {
    const policy = await createPolicy("2026-10-03T12:01:00Z");
    expect(() => policy.assertCanBook(at("2026-10-03T13:00:00Z"))).toThrow(BadRequestException);
  });

  it("RN-01: rejects a cancellation after the deadline", async () => {
    const policy = await createPolicy("2026-10-03T12:01:00Z");
    expect(() => policy.assertCanCancel(at("2026-10-03T14:00:00Z"))).toThrow(BadRequestException);
  });

  it("RN-02: rejects a check-in after the late arrival tolerance", async () => {
    const policy = await createPolicy("2026-10-03T12:11:00Z");
    expect(() => policy.assertCanCheckIn(at("2026-10-03T12:00:00Z"))).toThrow(BadRequestException);
  });

  it("RN-05: accepts only the configured session duration", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z", { sessionDurationMinutes: 30 });
    expect(() => policy.assertDuration(at("2026-10-05T13:00:00Z"), at("2026-10-05T13:30:00Z"))).not.toThrow();
    expect(() => policy.assertDuration(at("2026-10-05T13:00:00Z"), at("2026-10-05T13:20:00Z"))).toThrow(
      BadRequestException,
    );
  });

  it("RN-06: rejects a booking when the employee reached the active booking limit", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z", { maxActiveBookingsPerEmployee: 2 });
    expect(() => policy.assertWithinActiveBookingLimit(1)).not.toThrow();
    expect(() => policy.assertWithinActiveBookingLimit(2)).toThrow(ConflictException);
  });

  it("RN-07: rejects a booking beyond the booking horizon", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z", { bookingHorizonDays: 7 });
    expect(() => policy.assertCanBook(at("2026-10-11T12:00:00Z"))).toThrow(BadRequestException);
  });

  it("RN-08: rejects sessions during lunch", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z");
    expect(() => policy.assertOperatingHours(at("2026-10-05T15:00:00Z"), at("2026-10-05T16:00:00Z"), timezone)).toThrow(
      BadRequestException,
    );
  });

  it("RN-08: accepts a session on a working day outside lunch", async () => {
    const policy = await createPolicy("2026-10-03T12:00:00Z");
    expect(() =>
      policy.assertOperatingHours(at("2026-10-05T13:00:00Z"), at("2026-10-05T14:00:00Z"), timezone),
    ).not.toThrow();
  });

  it("RN-08: follows the configured working days", async () => {
    const saturdayStart = at("2026-10-10T13:00:00Z");
    const saturdayEnd = at("2026-10-10T13:20:00Z");
    const weekdaysOnly = await createPolicy("2026-10-03T12:00:00Z");
    const withSaturday = await createPolicy("2026-10-03T12:00:00Z", { workDays: [1, 2, 3, 4, 5, 6] });
    expect(() => weekdaysOnly.assertOperatingHours(saturdayStart, saturdayEnd, timezone)).toThrow(BadRequestException);
    expect(() => withSaturday.assertOperatingHours(saturdayStart, saturdayEnd, timezone)).not.toThrow();
  });
});
