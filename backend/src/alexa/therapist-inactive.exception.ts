import { BadRequestException } from "@nestjs/common";
import { messages } from "../messages/catalog";

export class TherapistInactiveException extends BadRequestException {
  constructor() {
    super(messages.errors.therapistInactive);
  }
}
