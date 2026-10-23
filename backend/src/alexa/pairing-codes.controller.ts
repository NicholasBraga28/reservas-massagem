import { Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { PairingCodesService } from "./pairing-codes.service";

@Controller("therapists")
@Roles("HR")
export class PairingCodesController {
  constructor(private readonly pairingCodes: PairingCodesService) {}

  @Post(":id/alexa-pairing-code")
  generate(@CurrentActor() actor: RequestActor, @Param("id", ParseUUIDPipe) therapistId: string) {
    return this.pairingCodes.generate(actor.id, therapistId);
  }
}
