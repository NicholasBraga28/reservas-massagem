import { Controller, Get, UseGuards } from "@nestjs/common";
import { Public } from "./decorators/public.decorator";
import { DemoUsersService } from "./demo-users.service";
import { HeaderModeOnlyGuard } from "./guards/header-mode-only.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly demoUsers: DemoUsersService) {}

  @Public()
  @UseGuards(HeaderModeOnlyGuard)
  @Get("demo-users")
  listDemoUsers() {
    return this.demoUsers.listDemoUsers();
  }
}
