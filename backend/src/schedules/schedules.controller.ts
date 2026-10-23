import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { CreateScheduleSlotDto } from "./dto/create-schedule-slot.dto";
import { QuerySchedulesDto } from "./dto/query-schedules.dto";
import { UpdateScheduleSlotDto } from "./dto/update-schedule-slot.dto";
import { SchedulesService } from "./schedules.service";

@Controller("schedules")
@Roles("HR", "ADMIN")
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  list(@Query() query: QuerySchedulesDto) {
    return this.schedules.list(query);
  }

  @Patch(":id")
  update(
    @CurrentActor() actor: RequestActor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateScheduleSlotDto,
  ) {
    return this.schedules.update(actor.id, id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentActor() actor: RequestActor, @Param("id", ParseUUIDPipe) id: string) {
    await this.schedules.remove(actor.id, id);
  }

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() input: CreateScheduleSlotDto) {
    return this.schedules.create(actor.id, input);
  }
}
