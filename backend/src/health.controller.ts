import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";
import { PrismaService } from "./prisma/prisma.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException({ status: "not_ready" });
    }
  }
}
