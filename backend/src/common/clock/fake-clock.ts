import { Clock } from "./clock";

const MS_PER_MINUTE = 60_000;

export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = new Date(date.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * MS_PER_MINUTE);
  }
}
