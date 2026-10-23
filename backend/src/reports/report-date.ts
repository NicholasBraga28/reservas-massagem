const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;

export type LocalDateParts = Readonly<{
  date: string;
  hour: number;
  minute: number;
  weekday: string;
}>;

export function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10) === value;
}

export function addLocalDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDateTimeToUtc(value: string, timezone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  let candidate = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = datePartsAt(new Date(candidate), timezone);
    const localAsUtc = Date.UTC(
      Number(local.date.slice(0, 4)),
      Number(local.date.slice(5, 7)) - 1,
      Number(local.date.slice(8, 10)),
      local.hour,
      local.minute,
    );
    const difference = targetUtc - localAsUtc;
    if (difference === 0) break;
    candidate += difference;
  }
  return new Date(candidate);
}

export function datePartsAt(value: Date, timezone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: values.weekday,
  };
}

export function minuteOfDay(hour: number, minute: number): number {
  return hour * MINUTES_PER_HOUR + minute;
}

export function isoWeekday(date: string): number {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? DAYS_PER_WEEK : weekday;
}

export function startOfIsoWeek(date: string): string {
  return addLocalDays(date, 1 - isoWeekday(date));
}

export function endOfMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function formatLocalTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
