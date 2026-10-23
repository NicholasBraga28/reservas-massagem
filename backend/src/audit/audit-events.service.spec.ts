import { AuditEventsService } from "./audit-events.service";
import { PrismaService } from "../prisma/prisma.service";
import { messages } from "../messages/catalog";

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000011";
const EVENT_ID = "00000000-0000-4000-8000-000000000021";
const HR_ID = "00000000-0000-4000-8000-000000000031";
const EVENT_TIME = new Date("2026-10-21T14:00:00.000Z");

describe("AuditEventsService", () => {
  const prismaMock = {
    auditEvent: { findMany: jest.fn(), findUnique: jest.fn() },
    appointment: { findMany: jest.fn() },
  };
  let service: AuditEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: EVENT_ID,
        actorId: HR_ID,
        action: "APPOINTMENT_CANCELLED",
        entityType: "Appointment",
        entityId: APPOINTMENT_ID,
        createdAt: EVENT_TIME,
        data: { status: "CANCELLED", email: "private@example.com", healthData: "private" },
      },
    ]);
    prismaMock.appointment.findMany.mockResolvedValue([
      { id: APPOINTMENT_ID, room: { location: { timezone: "America/Sao_Paulo" } } },
    ]);
    service = new AuditEventsService(prismaMock as unknown as PrismaService);
  });

  it("TK-08.03 RF-22 RNF-04: queries only appointments in stable order and projects safe fields", async () => {
    const response = await service.list({});

    expect(prismaMock.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: "Appointment" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
    expect(response.items[0]).toEqual(
      expect.objectContaining({
        data: { status: "CANCELLED" },
        spokenText: "Agendamento cancelado, registrado em 21 de outubro às 11h.",
      }),
    );
    expect(JSON.stringify(response)).not.toMatch(/private@example\.com|healthData/);
  });

  it("TK-08.03 RF-22: rejects a missing cursor before querying a page", async () => {
    prismaMock.auditEvent.findUnique.mockResolvedValue(null);

    await expect(service.list({ cursor: "00000000-0000-4000-8000-000000000099" })).rejects.toThrow(
      messages.errors.invalidAuditCursor,
    );
    expect(prismaMock.auditEvent.findMany).not.toHaveBeenCalled();
  });
});
