import { isUUID } from "class-validator";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { ActorResolution, ActorResolver, STORED_ACTOR_SELECT, resolutionFor } from "./actor-resolver";

const USER_ID_HEADER = "x-user-id";

export class HeaderActorResolver implements ActorResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(request: Request): Promise<ActorResolution> {
    const userId = request.header(USER_ID_HEADER);
    if (!userId) return { outcome: "not_identified" };
    if (!isUUID(userId)) return { outcome: "not_recognized" };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: STORED_ACTOR_SELECT });
    return resolutionFor(user, userId);
  }
}
