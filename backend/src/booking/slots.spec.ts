import { slotsForWindow } from "./slots";

const at = (time: string) => new Date(`2026-10-20T${time}:00.000Z`);
const options = { durationMinutes: 20, stepMinutes: 20, now: at("08:00") };

describe("slotsForWindow", () => {
  it("RF-01: generates slots at the configured step without exceeding the window", () => {
    const slots = slotsForWindow({ startsAt: at("09:00"), endsAt: at("10:00"), busy: [] }, options);
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      at("09:00").toISOString(),
      at("09:20").toISOString(),
      at("09:40").toISOString(),
    ]);
  });

  it("RF-01: removes any slot that overlaps a block or a booking", () => {
    const slots = slotsForWindow(
      { startsAt: at("09:00"), endsAt: at("11:00"), busy: [{ startsAt: at("09:40"), endsAt: at("10:00") }] },
      options,
    );
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      at("09:00").toISOString(),
      at("09:20").toISOString(),
      at("10:00").toISOString(),
      at("10:20").toISOString(),
      at("10:40").toISOString(),
    ]);
  });

  it("RF-01: hides slots that already started", () => {
    const slots = slotsForWindow(
      { startsAt: at("09:00"), endsAt: at("10:00"), busy: [] },
      { ...options, now: at("09:10") },
    );
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      at("09:20").toISOString(),
      at("09:40").toISOString(),
    ]);
  });
});
