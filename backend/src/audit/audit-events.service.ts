import { BadRequestException, Injectable } from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { QueryAuditEventsDto } from "./dto/query-audit-events.dto";

type AuditEventRow = Readonly<{
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  data: Prisma.JsonValue;
}>;

type CursorRow = Readonly<{ id: string; entityType: string; createdAt: Date }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|\+00:00)$/;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const SAFE_APPOINTMENT_STATUSES = new Set<string>(Object.values(AppointmentStatus));
const SPOKEN_ACTIONS: ReadonlyMap<string, string> = new Map([
  ["APPOINTMENT_CREATED", messages.reports.auditActionNames.appointmentCreated],
  ["APPOINTMENT_CANCELLED", messages.reports.auditActionNames.appointmentCancelled],
  ["APPOINTMENT_CHECKED_IN", messages.reports.auditActionNames.appointmentCheckedIn],
  ["SESSION_STARTED", messages.reports.auditActionNames.sessionStarted],
  ["SESSION_FINISHED", messages.reports.auditActionNames.sessionFinished],
  ["SESSION_AUTO_COMPLETED", messages.reports.auditActionNames.sessionAutoCompleted],
]);

@Injectable()
export class AuditEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryAuditEventsDto) {
    const filters = this.validateQuery(query);
    const cursor = filters.cursor ? await this.findCursor(filters.cursor) : undefined;
    const where: Prisma.AuditEventWhereInput = {
      entityType: "Appointment",
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
        : {}),
      ...(filters.appointmentId ? { entityId: filters.appointmentId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(cursor
        ? {
            OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
          }
        : {}),
    };
    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
      select: { id: true, actorId: true, action: true, entityType: true, entityId: true, createdAt: true, data: true },
    });
    const hasNextPage = rows.length > filters.limit;
    const page = rows.slice(0, filters.limit);
    const timezones = await this.findAppointmentTimezones(page);
    const items = page.map((event) => this.presentEvent(event, timezones.get(event.entityId) ?? DEFAULT_TIMEZONE));

    return {
      items,
      nextCursor: hasNextPage ? (page[page.length - 1]?.id ?? null) : null,
      spokenText: messages.reports.auditListSummary(items.length),
    };
  }

  private validateQuery(query: QueryAuditEventsDto) {
    const from = query.from ? this.parseUtcDate(query.from) : undefined;
    const to = query.to ? this.parseUtcDate(query.to) : undefined;
    if ((query.from && !from) || (query.to && !to) || (from && to && from >= to)) {
      throw new BadRequestException(messages.errors.invalidReportPeriod);
    }
    if (
      (query.appointmentId && !UUID_PATTERN.test(query.appointmentId)) ||
      (query.actorId && !UUID_PATTERN.test(query.actorId)) ||
      (query.cursor && !UUID_PATTERN.test(query.cursor)) ||
      (query.action !== undefined && query.action.trim().length === 0)
    ) {
      if (query.cursor && !UUID_PATTERN.test(query.cursor)) throw this.invalidCursor();
      throw new BadRequestException(messages.errors.invalidReportFilter);
    }
    const limit = query.limit === undefined ? DEFAULT_PAGE_SIZE : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new BadRequestException(messages.errors.invalidReportFilter);
    }
    return {
      from,
      to,
      appointmentId: query.appointmentId,
      actorId: query.actorId,
      action: query.action,
      limit,
      cursor: query.cursor,
    };
  }

  private parseUtcDate(value: string): Date | undefined {
    if (!UTC_DATE_TIME_PATTERN.test(value)) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private async findCursor(id: string): Promise<CursorRow> {
    const cursor = await this.prisma.auditEvent.findUnique({
      where: { id },
      select: { id: true, entityType: true, createdAt: true },
    });
    if (!cursor || cursor.entityType !== "Appointment") throw this.invalidCursor();
    return cursor;
  }

  private invalidCursor(): BadRequestException {
    return new BadRequestException(messages.errors.invalidAuditCursor);
  }

  private async findAppointmentTimezones(events: readonly AuditEventRow[]): Promise<Map<string, string>> {
    const appointmentIds = [...new Set(events.map(({ entityId }) => entityId).filter((id) => UUID_PATTERN.test(id)))];
    if (appointmentIds.length === 0) return new Map();
    const appointments = await this.prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      select: { id: true, room: { select: { location: { select: { timezone: true } } } } },
    });
    return new Map(appointments.map(({ id, room }) => [id, room.location.timezone]));
  }

  private presentEvent(event: AuditEventRow, timezone: string) {
    const actionName = SPOKEN_ACTIONS.get(event.action) ?? messages.reports.unknownAuditAction;
    return {
      id: event.id,
      actorId: event.actorId,
      action: event.action,
      entityType: "Appointment",
      entityId: event.entityId,
      createdAt: event.createdAt.toISOString(),
      data: this.safeData(event.data),
      spokenText: messages.reports.auditEvent(
        actionName,
        this.formatAuditDateTime(event.createdAt, timezone),
        event.actorId === null,
      ),
    };
  }

  private safeData(data: Prisma.JsonValue): Readonly<{ status?: AppointmentStatus }> {
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const status = data.status;
    return typeof status === "string" && SAFE_APPOINTMENT_STATUSES.has(status)
      ? { status: status as AppointmentStatus }
      : {};
  }

  private formatAuditDateTime(value: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(value);
    const values = Object.fromEntries(
      parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
    );
    const date = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      day: "numeric",
      month: "long",
    }).format(value);
    const hour = Number(values.hour);
    const minute = values.minute === "00" ? "" : values.minute;
    return `${date} às ${hour}h${minute}`;
  }
}
