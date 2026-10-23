import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { BusinessRulesService } from "../business-rules/business-rules.service";
import {
  addLocalDays,
  datePartsAt,
  endOfMonth,
  formatLocalTime,
  isValidLocalDate,
  localDateTimeToUtc,
  minuteOfDay,
  startOfIsoWeek,
} from "./report-date";
import { QueryKpisDto } from "./dto/query-kpis.dto";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";

type Granularity = "DAY" | "WEEK" | "MONTH";
type Shift = "MORNING" | "AFTERNOON";
type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
type LocationTimezone = Readonly<{ id: string; timezone: string }>;
type AppointmentReportRow = Readonly<{
  startsAt: Date;
  status: AppointmentStatus;
  room: Readonly<{ location: LocationTimezone }>;
}>;
type Count<T extends string> = { readonly key: T; count: number };
type CancellationPeriod = {
  readonly key: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  scheduledAppointmentCount: number;
  cancelledAppointmentCount: number;
};

const DEFAULT_GRANULARITY: Granularity = "DAY";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHIFT_ORDER: readonly Shift[] = ["MORNING", "AFTERNOON"];
const WEEKDAY_ORDER: readonly Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const WEEKDAY_BY_NAME: Readonly<Record<string, Weekday>> = {
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
  Sunday: "SUNDAY",
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessRules: BusinessRulesService,
  ) {}

  async getKpis(query: QueryKpisDto) {
    const { from, to, locationId, therapistId, granularity } = this.validateQuery(query);
    const [locations, therapist] = await Promise.all([
      this.findLocations(locationId),
      therapistId ? this.prisma.therapist.findUnique({ where: { id: therapistId }, select: { id: true } }) : null,
    ]);
    if (therapistId && !therapist) throw new NotFoundException(messages.errors.therapistNotFound);

    const appointments = await this.findAppointments(locations, from, to, therapistId);
    const rules = this.businessRules.current();
    const demand = this.aggregateDemand(appointments, from, to, rules);
    const cancellations = this.aggregateCancellations(appointments, from, to, granularity);
    const cancellationTotals = appointments.reduce(
      (totals, appointment) => ({
        scheduled: totals.scheduled + 1,
        cancelled: totals.cancelled + Number(appointment.status === "CANCELLED"),
      }),
      { scheduled: 0, cancelled: 0 },
    );
    const cancellationRate = cancellationTotals.scheduled
      ? (cancellationTotals.cancelled / cancellationTotals.scheduled) * 100
      : 0;
    const timezone = locationId ? locations[0].timezone : DEFAULT_TIMEZONE;
    const spokenText = this.createSpokenText(
      from,
      to,
      demand,
      cancellationTotals.cancelled,
      cancellationTotals.scheduled,
      cancellationRate,
    );

    return {
      range: { from, to, granularity, timezone },
      filters: { locationId: locationId ?? null, therapistId: therapistId ?? null },
      demand,
      cancellations,
      spokenText,
    };
  }

  private validateQuery(query: QueryKpisDto): Readonly<{
    from: string;
    to: string;
    locationId?: string;
    therapistId?: string;
    granularity: Granularity;
  }> {
    const from = query.from;
    const to = query.to;
    if (!from || !to || !isValidLocalDate(from) || !isValidLocalDate(to) || from > to) {
      throw new BadRequestException(messages.errors.invalidReportPeriod);
    }
    if (
      (query.locationId && !UUID_PATTERN.test(query.locationId)) ||
      (query.therapistId && !UUID_PATTERN.test(query.therapistId))
    ) {
      throw new BadRequestException(messages.errors.invalidReportFilter);
    }
    const granularity = query.granularity ?? DEFAULT_GRANULARITY;
    if (granularity !== "DAY" && granularity !== "WEEK" && granularity !== "MONTH") {
      throw new BadRequestException(messages.errors.invalidReportFilter);
    }
    return { from, to, locationId: query.locationId, therapistId: query.therapistId, granularity };
  }

  private async findLocations(locationId?: string): Promise<LocationTimezone[]> {
    if (locationId) {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true, timezone: true },
      });
      if (!location) throw new NotFoundException(messages.errors.locationNotFound);
      return [location];
    }
    return this.prisma.location.findMany({ select: { id: true, timezone: true }, orderBy: { id: "asc" } });
  }

  private async findAppointments(
    locations: readonly LocationTimezone[],
    from: string,
    to: string,
    therapistId?: string,
  ): Promise<AppointmentReportRow[]> {
    if (locations.length === 0) return [];
    const locationRanges: Prisma.AppointmentWhereInput[] = locations.map((location) => ({
      room: { locationId: location.id },
      startsAt: {
        gte: localDateTimeToUtc(from, location.timezone),
        lt: localDateTimeToUtc(addLocalDays(to, 1), location.timezone),
      },
    }));
    return this.prisma.appointment.findMany({
      where: { OR: locationRanges, ...(therapistId ? { therapistId } : {}) },
      select: {
        startsAt: true,
        status: true,
        room: { select: { location: { select: { id: true, timezone: true } } } },
      },
    });
  }

  private aggregateDemand(
    appointments: readonly AppointmentReportRow[],
    from: string,
    to: string,
    rules: ReturnType<BusinessRulesService["current"]>,
  ) {
    const shifts: Count<Shift>[] = SHIFT_ORDER.map((key) => ({ key, count: 0 }));
    const weekdays: Count<Weekday>[] = WEEKDAY_ORDER.map((key) => ({ key, count: 0 }));
    const startTimes = this.validStartTimes(rules);
    const startTimeCounts = new Map(startTimes.map((time) => [time, 0]));

    for (const appointment of appointments) {
      const local = datePartsAt(appointment.startsAt, appointment.room.location.timezone);
      const localMinute = minuteOfDay(local.hour, local.minute);
      const shift = this.shiftFor(localMinute, rules);
      const weekday = WEEKDAY_BY_NAME[local.weekday];
      const startTime = formatLocalTime(local.hour, local.minute);
      if (shift) this.incrementCount(shifts, shift);
      if (weekday) this.incrementCount(weekdays, weekday);
      if (startTimeCounts.has(startTime)) startTimeCounts.set(startTime, (startTimeCounts.get(startTime) ?? 0) + 1);
    }

    const byShift = shifts.map(({ key, count }) => ({ shift: key, appointmentCount: count }));
    const byWeekday = weekdays.map(({ key, count }) => ({ weekday: key, appointmentCount: count }));
    const byStartTime = [...startTimeCounts.entries()].map(([time, appointmentCount]) => ({ time, appointmentCount }));
    return {
      byShift,
      mostRequestedShift: this.mostRequested(shifts),
      byWeekday,
      mostRequestedWeekday: this.mostRequested(weekdays),
      byStartTime,
      mostRequestedStartTime: this.mostRequested(
        startTimes.map((key) => ({ key, count: startTimeCounts.get(key) ?? 0 })),
      ),
    };
  }

  private validStartTimes(rules: ReturnType<BusinessRulesService["current"]>): string[] {
    const times: string[] = [];
    for (
      let start = rules.workStartMinutes;
      start + rules.sessionDurationMinutes <= rules.lunchStartMinutes;
      start += rules.slotStepMinutes
    ) {
      times.push(formatLocalTime(Math.floor(start / 60), start % 60));
    }
    for (
      let start = rules.lunchEndMinutes;
      start + rules.sessionDurationMinutes <= rules.workEndMinutes;
      start += rules.slotStepMinutes
    ) {
      times.push(formatLocalTime(Math.floor(start / 60), start % 60));
    }
    return times;
  }

  private shiftFor(localMinute: number, rules: ReturnType<BusinessRulesService["current"]>): Shift | undefined {
    if (localMinute >= rules.workStartMinutes && localMinute < rules.lunchStartMinutes) return "MORNING";
    if (localMinute >= rules.lunchEndMinutes && localMinute < rules.workEndMinutes) return "AFTERNOON";
    return undefined;
  }

  private incrementCount<T extends string>(counts: Count<T>[], key: T): void {
    const item = counts.find((count) => count.key === key);
    if (item) item.count += 1;
  }

  private mostRequested<T extends string>(counts: readonly Count<T>[]): T | null {
    const leader = counts.reduce<Count<T> | undefined>(
      (current, item) => (!current || item.count > current.count ? item : current),
      undefined,
    );
    return leader && leader.count > 0 ? leader.key : null;
  }

  private aggregateCancellations(
    appointments: readonly AppointmentReportRow[],
    from: string,
    to: string,
    granularity: Granularity,
  ) {
    const periods = this.createCancellationPeriods(from, to, granularity);
    for (const appointment of appointments) {
      const localDate = datePartsAt(appointment.startsAt, appointment.room.location.timezone).date;
      const key = this.periodDescriptor(localDate, granularity, from, to).key;
      const period = periods.get(key);
      if (!period) continue;
      period.scheduledAppointmentCount += 1;
      if (appointment.status === "CANCELLED") period.cancelledAppointmentCount += 1;
    }
    return [...periods.values()].map(
      ({ periodStart, periodEnd, scheduledAppointmentCount, cancelledAppointmentCount }) => ({
        periodStart,
        periodEnd,
        scheduledAppointmentCount,
        cancelledAppointmentCount,
        cancellationRatePercent: scheduledAppointmentCount
          ? this.roundRate((cancelledAppointmentCount / scheduledAppointmentCount) * 100)
          : 0,
      }),
    );
  }

  private createCancellationPeriods(
    from: string,
    to: string,
    granularity: Granularity,
  ): Map<string, CancellationPeriod> {
    const periods = new Map<string, CancellationPeriod>();
    for (let date = from; date <= to; date = addLocalDays(date, 1)) {
      const descriptor = this.periodDescriptor(date, granularity, from, to);
      if (!periods.has(descriptor.key)) {
        periods.set(descriptor.key, {
          ...descriptor,
          scheduledAppointmentCount: 0,
          cancelledAppointmentCount: 0,
        });
      }
    }
    return periods;
  }

  private periodDescriptor(date: string, granularity: Granularity, from: string, to: string) {
    const fullStart =
      granularity === "DAY" ? date : granularity === "WEEK" ? startOfIsoWeek(date) : `${date.slice(0, 7)}-01`;
    const fullEnd =
      granularity === "DAY" ? date : granularity === "WEEK" ? addLocalDays(fullStart, 6) : endOfMonth(date);
    return {
      key: fullStart,
      periodStart: fullStart < from ? from : fullStart,
      periodEnd: fullEnd > to ? to : fullEnd,
    };
  }

  private roundRate(rate: number): number {
    return Math.round(rate * 100) / 100;
  }

  private createSpokenText(
    from: string,
    to: string,
    demand: ReturnType<ReportsService["aggregateDemand"]>,
    cancelledCount: number,
    scheduledCount: number,
    cancellationRate: number,
  ): string {
    const formatDate = (date: string) =>
      new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${date}T00:00:00.000Z`),
      );
    const period = messages.reports.period(formatDate(from), formatDate(to));
    const shift = demand.mostRequestedShift
      ? messages.reports.shiftSummary(
          messages.reports.shiftNames[demand.mostRequestedShift],
          demand.byShift.find(({ shift: key }) => key === demand.mostRequestedShift)?.appointmentCount ?? 0,
        )
      : messages.reports.noShiftDemand;
    const weekday = demand.mostRequestedWeekday
      ? messages.reports.weekdaySummary(
          messages.reports.weekdayNames[demand.mostRequestedWeekday],
          demand.byWeekday.find(({ weekday: key }) => key === demand.mostRequestedWeekday)?.appointmentCount ?? 0,
        )
      : messages.reports.noWeekdayDemand;
    const startTime = demand.mostRequestedStartTime
      ? messages.reports.startTimeSummary(
          this.spokenTime(demand.mostRequestedStartTime),
          demand.byStartTime.find(({ time }) => time === demand.mostRequestedStartTime)?.appointmentCount ?? 0,
        )
      : messages.reports.noStartTimeDemand;
    const cancellation = scheduledCount
      ? messages.reports.cancellationSummary(
          cancelledCount,
          scheduledCount,
          new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
            cancellationRate,
          ),
        )
      : messages.reports.noCancellations;
    return messages.reports.kpiSummary(period, shift, weekday, startTime, cancellation);
  }

  private spokenTime(time: string): string {
    const [hour, minute] = time.split(":");
    return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
  }
}
