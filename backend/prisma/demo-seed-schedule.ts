import type { BusinessRules } from "../src/config/business-rules.config";

type IsoWeekday = number;
type MinutesSinceMidnight = number;

export type WorkingHoursRules = Pick<
  BusinessRules,
  "workDays" | "workStartMinutes" | "lunchStartMinutes" | "lunchEndMinutes" | "workEndMinutes" | "bookingHorizonDays"
>;

export type SchedulePeriod = Readonly<{ startsAt: Date; endsAt: Date }>;

type LocalDate = Readonly<{ year: number; month: number; day: number }>;
type LocalDateWithWeekday = LocalDate & Readonly<{ isoWeekday: IsoWeekday }>;

const MS_PER_MINUTE = 60_000;

function localDateOf(date: Date, timezone: string): LocalDate {
  const parts = partsOf(date, timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function partsOf(date: Date, timezone: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function addDays(localDate: LocalDate, days: number): LocalDateWithWeekday {
  const utcNoon = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + days, 12));
  const jsWeekday = utcNoon.getUTCDay();
  return {
    year: utcNoon.getUTCFullYear(),
    month: utcNoon.getUTCMonth() + 1,
    day: utcNoon.getUTCDate(),
    isoWeekday: jsWeekday === 0 ? 7 : jsWeekday,
  };
}

function timezoneOffsetMinutes(utcInstant: Date, timezone: string): number {
  const parts = partsOf(utcInstant, timezone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - utcInstant.getTime()) / MS_PER_MINUTE);
}

function localTimeToUtc(localDate: LocalDate, minutesSinceMidnight: MinutesSinceMidnight, timezone: string): Date {
  const naiveUtc = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day) + minutesSinceMidnight * MS_PER_MINUTE,
  );
  const offsetMinutes = timezoneOffsetMinutes(naiveUtc, timezone);
  return new Date(naiveUtc.getTime() - offsetMinutes * MS_PER_MINUTE);
}

export function generateUpcomingWorkPeriods(rules: WorkingHoursRules, now: Date, timezone: string): SchedulePeriod[] {
  const today = localDateOf(now, timezone);
  const periods: SchedulePeriod[] = [];
  for (let offset = 1; offset <= rules.bookingHorizonDays; offset++) {
    const candidate = addDays(today, offset);
    if (!rules.workDays.includes(candidate.isoWeekday)) continue;
    periods.push(
      {
        startsAt: localTimeToUtc(candidate, rules.workStartMinutes, timezone),
        endsAt: localTimeToUtc(candidate, rules.lunchStartMinutes, timezone),
      },
      {
        startsAt: localTimeToUtc(candidate, rules.lunchEndMinutes, timezone),
        endsAt: localTimeToUtc(candidate, rules.workEndMinutes, timezone),
      },
    );
  }
  return periods;
}
