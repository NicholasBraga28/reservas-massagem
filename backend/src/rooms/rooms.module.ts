import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
  providers: [AuditService, RoomsService],
})
export class RoomsModule {}
