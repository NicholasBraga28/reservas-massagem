import { Injectable } from "@nestjs/common";
import { firstNameOf } from "../common/names/first-name";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { ProfileDto } from "./dto/profile.dto";
import { effectiveRolesOf } from "./role-inheritance";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async profileOf(userId: string): Promise<ProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true, name: true, therapist: { select: { id: true } } },
    });
    const firstName = firstNameOf(user.name);
    return {
      id: user.id,
      role: user.role,
      effectiveRoles: effectiveRolesOf(user.role),
      name: user.name,
      firstName,
      therapistId: user.role === "THERAPIST" ? (user.therapist?.id ?? null) : null,
      spokenText: messages.profile.signedInAs(firstName, messages.roles.spoken[user.role]),
    };
  }
}
