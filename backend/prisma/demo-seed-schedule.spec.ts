import { generateUpcomingWorkPeriods, WorkingHoursRules } from "./demo-seed-schedule";

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

const RULES: WorkingHoursRules = {
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 9 * 60,
  lunchStartMinutes: 12 * 60,
  lunchEndMinutes: 13 * 60,
  workEndMinutes: 18 * 60,
  bookingHorizonDays: 21,
};

describe("generateUpcomingWorkPeriods", () => {
  it("RN-08: generates the morning and afternoon periods for the next business day", () => {
    const mondayNineAmInSaoPaulo = new Date("2026-10-19T12:00:00.000Z");

    const periods = generateUpcomingWorkPeriods(RULES, mondayNineAmInSaoPaulo, SAO_PAULO_TIMEZONE);

    expect(periods[0]).toEqual({
      startsAt: new Date("2026-10-20T12:00:00.000Z"),
      endsAt: new Date("2026-10-20T15:00:00.000Z"),
    });
    expect(periods[1]).toEqual({
      startsAt: new Date("2026-10-20T16:00:00.000Z"),
      endsAt: new Date("2026-10-20T21:00:00.000Z"),
    });
  });

  it("RN-08: skips Saturday and Sunday, resuming on Monday", () => {
    const thursdayNineAmInSaoPaulo = new Date("2026-10-22T12:00:00.000Z");

    const periods = generateUpcomingWorkPeriods(RULES, thursdayNineAmInSaoPaulo, SAO_PAULO_TIMEZONE);

    const fridayMorning = {
      startsAt: new Date("2026-10-23T12:00:00.000Z"),
      endsAt: new Date("2026-10-23T15:00:00.000Z"),
    };
    const mondayMorning = {
      startsAt: new Date("2026-10-26T12:00:00.000Z"),
      endsAt: new Date("2026-10-26T15:00:00.000Z"),
    };
    expect(periods[0]).toEqual(fridayMorning);
    expect(periods[2]).toEqual(mondayMorning);
  });

  it("RN-07: never generates a period beyond the booking horizon", () => {
    const mondayNineAmInSaoPaulo = new Date("2026-10-19T12:00:00.000Z");
    const everyDayWorks: WorkingHoursRules = { ...RULES, workDays: [1, 2, 3, 4, 5, 6, 7], bookingHorizonDays: 2 };

    const periods = generateUpcomingWorkPeriods(everyDayWorks, mondayNineAmInSaoPaulo, SAO_PAULO_TIMEZONE);

    expect(periods).toHaveLength(4);
    expect(periods.every((period) => period.startsAt < new Date("2026-10-22T00:00:00.000Z"))).toBe(true);
  });

  it("RN-08: at 23h30 in São Paulo, the first generated day is the next São Paulo day", () => {
    const mondayElevenThirtyPmInSaoPaulo = new Date("2026-10-20T02:30:00.000Z");

    const periods = generateUpcomingWorkPeriods(RULES, mondayElevenThirtyPmInSaoPaulo, SAO_PAULO_TIMEZONE);

    expect(periods[0]).toEqual({
      startsAt: new Date("2026-10-20T12:00:00.000Z"),
      endsAt: new Date("2026-10-20T15:00:00.000Z"),
    });
  });
});
