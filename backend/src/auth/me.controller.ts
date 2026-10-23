import { Controller, Get } from "@nestjs/common";
import { CurrentActor } from "./decorators/current-actor.decorator";
import { ProfileService } from "./profile.service";
import type { RequestActor } from "./request-actor";

@Controller("me")
export class MeController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  me(@CurrentActor() actor: RequestActor) {
    return this.profiles.profileOf(actor.id);
  }
}
