import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { TherapistService } from "./therapist.service";
import { BlockDto } from "../common/dto";

@Controller("therapist")
@Roles("THERAPIST")
export class TherapistController {
  constructor(private readonly therapist: TherapistService) {}
  @Get("agenda") agenda(@CurrentActor() actor: RequestActor, @Query("from") from: string, @Query("to") to: string) {
    return this.therapist.agenda(actor.id, new Date(from), new Date(to));
  }
  @Get("next") next(@CurrentActor() actor: RequestActor) {
    return this.therapist.next(actor.id);
  }
  @Delete("appointments/:id") cancel(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.therapist.cancel(actor.id, id);
  }
  @Post("blocks") block(@CurrentActor() actor: RequestActor, @Body() body: BlockDto) {
    return this.therapist.block(actor.id, body);
  }
  @Post("appointments/:id/start") start(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.therapist.start(actor.id, id);
  }
  @Post("appointments/:id/finish") finish(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.therapist.finish(actor.id, id);
  }
}
