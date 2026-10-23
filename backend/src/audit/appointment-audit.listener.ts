import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AppointmentEvents, AppointmentBookedEvent, AppointmentCancelledEvent } from "../booking/appointment-events";

@Injectable()
export class AppointmentAuditListener implements OnModuleInit {
  constructor(
    private readonly events: AppointmentEvents,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.events.onBooked((event) => this.recordCreated(event));
    this.events.onCancelled((event) => this.recordCancelled(event));
  }

  private recordCreated(event: AppointmentBookedEvent): Promise<void> {
    return this.recordOnce(event, "APPOINTMENT_CREATED", { status: "CONFIRMED" });
  }

  private recordCancelled(event: AppointmentCancelledEvent): Promise<void> {
    return this.recordOnce(event, "APPOINTMENT_CANCELLED", { status: "CANCELLED" });
  }

  private async recordOnce(
    event: AppointmentBookedEvent | AppointmentCancelledEvent,
    action: string,
    data: { status: string },
  ): Promise<void> {
    const existing = await this.prisma.auditEvent.findFirst({
      where: { actorId: event.employeeId, action, entityType: "Appointment", entityId: event.appointmentId },
      select: { id: true },
    });
    if (existing) return;
    await this.prisma.auditEvent.create({
      data: { actorId: event.employeeId, action, entityType: "Appointment", entityId: event.appointmentId, data },
    });
  }
}
