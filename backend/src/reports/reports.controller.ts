import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { QueryKpisDto } from "./dto/query-kpis.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@Roles("HR", "ADMIN")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("kpis")
  getKpis(@Query() query: QueryKpisDto) {
    return this.reports.getKpis(query);
  }
}
