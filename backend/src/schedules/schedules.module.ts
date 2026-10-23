import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { BusinessRulesModule } from "../business-rules/business-rules.module";
import { ClockModule } from "../common/clock/clock.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PolicyService } from "../domain/policy.service";
import { SchedulesController } from "./schedules.controller";
import { SchedulesService } from "./schedules.service";

@Module({
  imports: [BusinessRulesModule, ClockModule, PrismaModule],
  controllers: [SchedulesController],
  providers: [AuditService, PolicyService, SchedulesService],
})
export class SchedulesModule {}
