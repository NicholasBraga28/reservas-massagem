import { ConflictException } from "@nestjs/common";
import { messages } from "../messages/catalog";

export class UserEmailAlreadyExistsException extends ConflictException {
  constructor() {
    super(messages.errors.userEmailAlreadyExists);
  }
}
