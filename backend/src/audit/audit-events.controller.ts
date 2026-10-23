import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditEventsService } from "./audit-events.service";
import { QueryAuditEventsDto } from "./dto/query-audit-events.dto";

@Controller("audit-events")
@Roles("HR", "ADMIN")
export class AuditEventsController {
  constructor(private readonly auditEvents: AuditEventsService) {}

  @Get()
  list(@Query() query: QueryAuditEventsDto) {
    return this.auditEvents.list(query);
  }
}
