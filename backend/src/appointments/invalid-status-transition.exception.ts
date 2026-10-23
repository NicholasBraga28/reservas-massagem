import { ConflictException } from "@nestjs/common";
import { messages } from "../messages/catalog";
import type { StatusTransition } from "./appointment-status";

export type RefusedStatusTransition = StatusTransition & Readonly<{ appointmentId: string }>;

export class InvalidStatusTransitionException extends ConflictException {
  constructor(readonly transition: RefusedStatusTransition) {
    super(messages.errors.invalidStatusTransition);
  }
}
