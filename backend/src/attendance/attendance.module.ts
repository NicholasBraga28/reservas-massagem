import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AppointmentCompletionJob } from "./jobs/appointment-completion.job";
import { AttendanceToleranceJob } from "./jobs/attendance-tolerance.job";

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [AttendanceToleranceJob, AppointmentCompletionJob],
})
export class AttendanceModule {}
