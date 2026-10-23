import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { AdminService } from "./admin.service";
import { AvailabilityDto, BlockDto } from "../common/dto";

@Controller("admin")
@Roles("HR")
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Post("blocks") block(@CurrentActor() actor: RequestActor, @Body() body: BlockDto) {
    return this.admin.block(body, actor.id);
  }
  @Post("therapists/:id/availability") availability(
    @CurrentActor() actor: RequestActor,
    @Param("id") id: string,
    @Body() body: AvailabilityDto,
  ) {
    return this.admin.addAvailability(id, body, actor.id);
  }
  @Get("audit") audit() {
    return this.admin.auditEvents();
  }
  @Get("kpis") kpis(@Query("from") from: string, @Query("to") to: string) {
    return this.admin.kpis(new Date(from), new Date(to));
  }
}
