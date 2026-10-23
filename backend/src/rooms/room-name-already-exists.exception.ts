import { ConflictException } from "@nestjs/common";
import { messages } from "../messages/catalog";

export class RoomNameAlreadyExistsException extends ConflictException {
  constructor() {
    super(messages.errors.roomNameAlreadyExists);
  }
}
