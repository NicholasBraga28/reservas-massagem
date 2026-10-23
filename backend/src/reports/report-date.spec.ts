import { addLocalDays, datePartsAt, isoWeekday, isValidLocalDate, localDateTimeToUtc } from "./report-date";

describe("report date helpers", () => {
  it("TK-08.02 RF-21: validates calendar dates and advances across leap day", () => {
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(addLocalDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("TK-08.02 RNF-05: converts the local start of day to UTC using the location timezone", () => {
    expect(localDateTimeToUtc("2026-10-19", "America/Sao_Paulo").toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(datePartsAt(new Date("2026-10-19T12:00:00.000Z"), "America/Sao_Paulo")).toEqual({
      date: "2026-10-19",
      hour: 9,
      minute: 0,
      weekday: "Monday",
    });
  });

  it("TK-08.02 RF-21: calculates ISO weekdays with Monday as the start of week", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
  });
});
