import { IsString } from "class-validator";
import { messages } from "../../messages/catalog";

export class UpdateBusinessRuleDto {
  @IsString({ message: messages.errors.invalidBusinessRuleValue })
  readonly value!: string;
}
