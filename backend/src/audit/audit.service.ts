import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  record(actorId: string | null, action: string, entityType: string, entityId: string, data?: Prisma.InputJsonValue) {
    return this.prisma.auditEvent.create({ data: { actorId, action, entityType, entityId, data } });
  }
}
