import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnvironment } from "./config/env.validation";
import { ClockModule } from "./common/clock/clock.module";
import { BusinessRulesModule } from "./business-rules/business-rules.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PolicyService } from "./domain/policy.service";
import { AuditService } from "./audit/audit.service";
import { AuthModule } from "./auth/auth.module";
import { BookingService } from "./booking/booking.service";
import { BookingController } from "./booking/booking.controller";
import { AdminService } from "./admin/admin.service";
import { AdminController } from "./admin/admin.controller";
import { TherapistService } from "./therapist/therapist.service";
import { TherapistController } from "./therapist/therapist.controller";
import { HealthController } from "./health.controller";
import { AlexaController } from "./alexa/alexa.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { SchedulesModule } from "./schedules/schedules.module";
import { AppointmentEvents } from "./booking/appointment-events";
import { WaitlistService } from "./waitlist/waitlist.service";
import { AppointmentAuditListener } from "./audit/appointment-audit.listener";
import { AttendanceModule } from "./attendance/attendance.module";
import { ReportsModule } from "./reports/reports.module";
import { AuditEventsModule } from "./audit/audit-events.module";
import { UsersModule } from "./users/users.module";
import { RoomsModule } from "./rooms/rooms.module";
import { AlexaModule } from "./alexa/alexa.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ClockModule,
    PrismaModule,
    BusinessRulesModule,
    AuthModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    SchedulesModule,
    NotificationsModule,
    AttendanceModule,
    ReportsModule,
    AuditEventsModule,
    UsersModule,
    RoomsModule,
    AlexaModule,
  ],
  controllers: [HealthController, BookingController, AdminController, TherapistController, AlexaController],
  providers: [
    PolicyService,
    AuditService,
    BookingService,
    AppointmentEvents,
    AppointmentAuditListener,
    WaitlistService,
    AdminService,
    TherapistService,
  ],
})
export class AppModule {}
