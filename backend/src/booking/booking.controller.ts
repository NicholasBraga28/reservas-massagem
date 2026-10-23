import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { BookingService } from "./booking.service";
import { CreateAppointmentDto } from "../common/dto";
import { AvailabilityQueryDto } from "./dto/availability-query.dto";
import { QueryMyAppointmentsDto } from "./dto/query-my-appointments.dto";
import { WaitlistService } from "../waitlist/waitlist.service";
import { JoinWaitlistDto } from "../waitlist/dto/join-waitlist.dto";

@Controller("booking")
@Roles("EMPLOYEE")
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly waitlistService: WaitlistService,
  ) {}

  @Get("availability")
  availability(@Query() query: AvailabilityQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (query.durationMinutes !== undefined) {
      return this.booking.availableSlots(from, to, query.durationMinutes, query.therapistId, query.locationCode, true);
    }
    return this.booking.availability(from, to);
  }

  @Get("slots")
  slots(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("durationMinutes") duration: string,
    @Query("therapistId") therapistId?: string,
  ) {
    return this.booking.availableSlots(new Date(from), new Date(to), Number(duration), therapistId);
  }

  @Get("appointments")
  mine(@CurrentActor() actor: RequestActor, @Query() query: QueryMyAppointmentsDto) {
    return this.booking.listMine(actor.id, query);
  }

  @Get("appointments/next")
  next(@CurrentActor() actor: RequestActor) {
    return this.booking.nextAppointment(actor.id);
  }

  @Post("appointments")
  reserve(@CurrentActor() actor: RequestActor, @Body() body: CreateAppointmentDto) {
    return this.booking.reserve(actor.id, body);
  }

  @Delete("appointments/:id")
  cancel(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.booking.cancel(id, actor.id);
  }

  @Post("waitlist")
  waitlist(@CurrentActor() actor: RequestActor, @Body() body: JoinWaitlistDto) {
    return this.waitlistService.join(actor.id, body);
  }

  @Delete("waitlist/:id")
  @HttpCode(204)
  leaveWaitlist(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.waitlistService.remove(actor.id, id);
  }

  @Post("waitlist/:id/accept")
  acceptWaitlist(@CurrentActor() actor: RequestActor, @Param("id") id: string) {
    return this.waitlistService.accept(actor.id, id);
  }

  @Post("check-in/:token")
  @HttpCode(200)
  checkIn(@CurrentActor() actor: RequestActor, @Param("token") token: string) {
    return this.booking.checkIn(token, actor.id);
  }
}
