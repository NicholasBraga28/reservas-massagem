import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { CreateUserDto } from "./dto/create-user.dto";
import { QueryUsersDto } from "./dto/query-users.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UsersService } from "./users.service";

@Controller("users")
@Roles("HR")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: QueryUsersDto) {
    return this.users.list(query);
  }

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() input: CreateUserDto) {
    return this.users.create(actor.id, input);
  }

  @Patch(":id/status")
  changeStatus(
    @CurrentActor() actor: RequestActor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateUserStatusDto,
  ) {
    return this.users.changeStatus(actor.id, id, input);
  }
}
