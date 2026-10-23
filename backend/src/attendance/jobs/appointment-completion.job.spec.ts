import { Test } from "@nestjs/testing";
import { FakeClock } from "../../common/clock/fake-clock";
import { CLOCK } from "../../common/clock/clock";
import { PrismaService } from "../../prisma/prisma.service";
import { AppointmentCompletionJob } from "./appointment-completion.job";

const NOW = new Date("2026-10-21T14:00:00.000Z");

describe("AppointmentCompletionJob", () => {
  const findMany = jest.fn();
  const updateMany = jest.fn();
  const auditCreate = jest.fn();
  const transaction = { appointment: { updateMany }, auditEvent: { create: auditCreate } };
  const prisma = {
    appointment: { findMany },
    $transaction: (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as unknown as PrismaService;
  const clock = new FakeClock(NOW);
  let job: AppointmentCompletionJob;

  beforeEach(async () => {
    clock.set(NOW);
    findMany.mockReset();
    updateMany.mockReset();
    auditCreate.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AppointmentCompletionJob,
        { provide: PrismaService, useValue: prisma },
        { provide: CLOCK, useValue: clock },
      ],
    }).compile();
    job = module.get(AppointmentCompletionJob);
  });

  it("TK-05.04 RN-16: selects expired in-progress appointments and completes them at the Clock instant", async () => {
    findMany.mockResolvedValue([{ id: "appointment-1", status: "IN_PROGRESS" }]);
    updateMany.mockResolvedValue({ count: 1 });

    await job.run();

    expect(findMany).toHaveBeenCalledWith({
      where: {
        endsAt: { lte: NOW },
        sessionEndedAt: null,
        OR: [{ status: "IN_PROGRESS" }, { status: "CHECKED_IN", sessionStartedAt: null }],
      },
      select: { id: true, status: true },
      orderBy: { endsAt: "asc" },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "appointment-1", status: "IN_PROGRESS", endsAt: { lte: NOW }, sessionEndedAt: null },
      data: { status: "COMPLETED", sessionEndedAt: NOW },
    });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("TK-05.05 D-06 RN-16: completes an unstarted checked-in appointment and writes a system audit atomically", async () => {
    findMany.mockResolvedValue([{ id: "appointment-2", status: "CHECKED_IN" }]);
    updateMany.mockResolvedValue({ count: 1 });
    auditCreate.mockResolvedValue({});

    await job.run();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "appointment-2",
        status: "CHECKED_IN",
        endsAt: { lte: NOW },
        sessionEndedAt: null,
        sessionStartedAt: null,
      },
      data: { status: "COMPLETED", sessionEndedAt: NOW },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: "SESSION_AUTO_COMPLETED",
        entityType: "Appointment",
        entityId: "appointment-2",
        data: { from: "CHECKED_IN", to: "COMPLETED", actor: "SYSTEM" },
      },
    });
  });

  it("TK-05.05 D-06 RN-16: does not write an audit when a concurrent update already changed the appointment", async () => {
    findMany.mockResolvedValue([{ id: "appointment-2", status: "CHECKED_IN" }]);
    updateMany.mockResolvedValue({ count: 0 });

    await job.run();

    expect(auditCreate).not.toHaveBeenCalled();
  });
});
