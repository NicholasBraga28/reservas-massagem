export type BusyPeriod = { startsAt: Date; endsAt: Date };
export type WindowWithBusy = BusyPeriod & { busy: BusyPeriod[] };
export type SlotOptions = Readonly<{ durationMinutes: number; stepMinutes: number; now: Date }>;

const MS_PER_MINUTE = 60_000;

export function slotsForWindow(window: WindowWithBusy, { durationMinutes, stepMinutes, now }: SlotOptions) {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
  const durationMs = durationMinutes * MS_PER_MINUTE;
  const stepMs = stepMinutes * MS_PER_MINUTE;
  const result: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (let start = window.startsAt.getTime(); start + durationMs <= window.endsAt.getTime(); start += stepMs) {
    const endsAt = new Date(start + durationMs);
    const startsAt = new Date(start);
    if (startsAt < now) continue;
    if (!window.busy.some((period) => period.startsAt < endsAt && period.endsAt > startsAt))
      result.push({ startsAt, endsAt });
  }
  return result;
}
