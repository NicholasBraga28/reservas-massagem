import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { CreateRoomDto } from "./dto/create-room.dto";
import { QueryRoomsDto } from "./dto/query-rooms.dto";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@Roles("HR")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@Query() query: QueryRoomsDto) {
    return this.rooms.list(query);
  }

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() input: CreateRoomDto) {
    return this.rooms.create(actor.id, input);
  }

  @Post(":id/regenerate-token")
  @HttpCode(HttpStatus.OK)
  regenerateToken(@CurrentActor() actor: RequestActor, @Param("id", ParseUUIDPipe) id: string) {
    return this.rooms.regenerateToken(actor.id, id);
  }
}
