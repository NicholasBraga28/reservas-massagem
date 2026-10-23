import { Controller, Get, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationService } from "./notification.service";

@Controller("notifications")
@Roles("EMPLOYEE", "THERAPIST")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentActor() actor: RequestActor, @Query() query: NotificationQueryDto) {
    return this.notifications.list(actor.id, query);
  }
}
