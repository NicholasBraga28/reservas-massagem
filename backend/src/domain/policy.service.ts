import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import { CLOCK, Clock } from "../common/clock/clock";
import { messages } from "../messages/catalog";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MINUTES_PER_HOUR = 60;
const ISO_WEEKDAY_BY_NAME: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

@Injectable()
export class PolicyService {
  constructor(
    private readonly businessRules: BusinessRulesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private get currentRules() {
    return this.businessRules.current();
  }

  get reminderLeadMs() {
    return this.currentRules.reminderLeadMinutes * MS_PER_MINUTE;
  }
  get waitlistAcceptanceMs() {
    return this.currentRules.waitlistAcceptanceMinutes * MS_PER_MINUTE;
  }
  get checkInEarlyMs() {
    return this.currentRules.checkInEarlyMinutes * MS_PER_MINUTE;
  }
  get lateArrivalToleranceMs() {
    return this.currentRules.lateArrivalToleranceMinutes * MS_PER_MINUTE;
  }
  get slotStepMinutes() {
    return this.currentRules.slotStepMinutes;
  }

  isAllowedDuration(minutes: number) {
    return minutes === this.currentRules.sessionDurationMinutes;
  }

  assertPeriod(startsAt: Date, endsAt: Date) {
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException(messages.errors.invalidPeriod);
    }
  }

  assertCanBook(startsAt: Date) {
    const now = this.clock.now();
    const earliest = new Date(now.getTime() + this.currentRules.bookingMinNoticeMinutes * MS_PER_MINUTE);
    if (startsAt < earliest) throw new BadRequestException(messages.errors.bookingNotice);
    const horizon = new Date(now.getTime() + this.currentRules.bookingHorizonDays * MS_PER_DAY);
    if (startsAt > horizon) throw new BadRequestException(messages.errors.outsideBookingHorizon);
  }

  assertCanCancel(startsAt: Date) {
    const latest = new Date(startsAt.getTime() - this.currentRules.cancellationMinNoticeMinutes * MS_PER_MINUTE);
    if (this.clock.now() > latest) throw new BadRequestException(messages.errors.cancellationNotice);
  }

  assertCanCheckIn(startsAt: Date) {
    const now = this.clock.now();
    const opensAt = new Date(startsAt.getTime() - this.checkInEarlyMs);
    if (now < opensAt) throw new BadRequestException(messages.errors.checkInTooEarly);
    const deadline = new Date(startsAt.getTime() + this.lateArrivalToleranceMs);
    if (now > deadline) throw new BadRequestException(messages.errors.lateCheckIn);
  }

  assertDuration(startsAt: Date, endsAt: Date) {
    const duration = (endsAt.getTime() - startsAt.getTime()) / MS_PER_MINUTE;
    if (!this.isAllowedDuration(duration)) throw new BadRequestException(messages.errors.invalidDuration);
  }

  assertWithinActiveBookingLimit(activeBookings: number) {
    if (activeBookings >= this.currentRules.maxActiveBookingsPerEmployee) {
      throw new ConflictException(messages.errors.activeBookingLimit);
    }
  }

  assertOperatingHours(startsAt: Date, endsAt: Date, timezone: string) {
    const start = localParts(startsAt, timezone);
    const end = localParts(endsAt, timezone);
    const { workDays, workStartMinutes, workEndMinutes, lunchStartMinutes, lunchEndMinutes } = this.currentRules;
    const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
    const isWorkDay = workDays.includes(ISO_WEEKDAY_BY_NAME[start.weekday]);
    const withinDay = start.minutes >= workStartMinutes && end.minutes <= workEndMinutes;
    const avoidsLunch = end.minutes <= lunchStartMinutes || start.minutes >= lunchEndMinutes;
    if (!sameDay || !isWorkDay || !withinDay || !avoidsLunch) {
      throw new BadRequestException(messages.errors.outsideOperatingHours);
    }
  }

  assertScheduleOperatingHours(startsAt: Date, endsAt: Date, timezone: string) {
    const start = localParts(startsAt, timezone);
    const end = localParts(endsAt, timezone);
    const { workDays, workStartMinutes, workEndMinutes } = this.currentRules;
    const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
    const isWorkDay = workDays.includes(ISO_WEEKDAY_BY_NAME[start.weekday]);
    const withinDay = start.minutes >= workStartMinutes && end.minutes <= workEndMinutes;
    if (!sameDay || !isWorkDay || !withinDay) {
      throw new BadRequestException(messages.errors.outsideOperatingHours);
    }
  }
}

function localParts(date: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
    minutes: Number(parts.hour) * MINUTES_PER_HOUR + Number(parts.minute),
  };
}
