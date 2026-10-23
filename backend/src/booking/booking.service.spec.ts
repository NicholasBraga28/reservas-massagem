import { isRetryableTransactionError } from "../prisma/transaction-errors";
import { BookingService } from "./booking.service";

describe("BookingService", () => {
  it("TK-04.02 RF-02 RN-12: recognizes PostgreSQL deadlocks as retryable transaction errors", () => {
    expect(isRetryableTransactionError({ message: "deadlock detected (SQLSTATE 40P01)" })).toBe(true);
  });

  it("TK-04.02 RF-02 RN-12: retries a reservation after a transient PostgreSQL deadlock", async () => {
    const appointment = {
      id: "appointment-id",
      startsAt: new Date("2026-10-22T14:00:00.000Z"),
      endsAt: new Date("2026-10-22T14:20:00.000Z"),
    };
    const details = {
      therapist: { user: { name: "Ana Souza" } },
      room: { name: "Sala 1", location: { code: "SAO_PAULO" } },
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce({ message: "deadlock detected (SQLSTATE 40P01)" })
        .mockResolvedValueOnce(appointment),
      appointment: { findUniqueOrThrow: jest.fn().mockResolvedValue(details) },
    };
    const policy = {
      assertPeriod: jest.fn(),
      assertDuration: jest.fn(),
      assertCanBook: jest.fn(),
    };
    const events = { emitBooked: jest.fn().mockResolvedValue(undefined) };
    const service = new BookingService(
      prisma as never,
      policy as never,
      {} as never,
      events as never,
      { notify: jest.fn().mockResolvedValue(undefined) } as never,
      { now: () => new Date("2026-10-21T12:00:00.000Z") },
    );

    await expect(
      service.reserve("employee-id", {
        therapistId: "therapist-id",
        roomId: "room-id",
        startsAt: "2026-10-22T14:00:00.000Z",
        endsAt: "2026-10-22T14:20:00.000Z",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: appointment.id }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
