import { Injectable } from "@nestjs/common";

export type AppointmentBookedEvent = Readonly<{
  appointmentId: string;
  employeeId: string;
}>;

export type AppointmentCancelledEvent = Readonly<{
  appointmentId: string;
  employeeId: string;
}>;

type BookedListener = (event: AppointmentBookedEvent) => void | Promise<void>;
type CancelledListener = (event: AppointmentCancelledEvent) => void | Promise<void>;

@Injectable()
export class AppointmentEvents {
  private readonly bookedListeners: BookedListener[] = [];
  private readonly cancelledListeners: CancelledListener[] = [];

  async emitBooked(event: AppointmentBookedEvent): Promise<void> {
    await Promise.all(this.bookedListeners.map((listener) => listener(event)));
  }

  onBooked(listener: BookedListener): void {
    this.bookedListeners.push(listener);
  }

  async emitCancelled(event: AppointmentCancelledEvent): Promise<void> {
    await Promise.all(this.cancelledListeners.map((listener) => listener(event)));
  }

  onCancelled(listener: CancelledListener): void {
    this.cancelledListeners.push(listener);
  }
}
