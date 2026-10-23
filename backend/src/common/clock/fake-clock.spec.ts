import { FakeClock } from "./fake-clock";

describe("FakeClock", () => {
  it("returns the configured instant until it is moved", () => {
    const clock = new FakeClock(new Date("2026-10-19T12:00:00Z"));
    expect(clock.now().toISOString()).toBe("2026-10-19T12:00:00.000Z");
    clock.advanceMinutes(15);
    expect(clock.now().toISOString()).toBe("2026-10-19T12:15:00.000Z");
    clock.set(new Date("2026-10-20T09:00:00Z"));
    expect(clock.now().toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  it("does not let callers change its time by mutating the returned date", () => {
    const clock = new FakeClock(new Date("2026-10-19T12:00:00Z"));
    clock.now().setFullYear(2000);
    expect(clock.now().toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });
});
