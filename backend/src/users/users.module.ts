import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [AuditService, UsersService],
})
export class UsersModule {}
