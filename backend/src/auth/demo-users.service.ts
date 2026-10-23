import { Injectable } from "@nestjs/common";
import type { UserRole } from "@prisma/client";
import { firstNameOf } from "../common/names/first-name";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { DemoUserDto } from "./dto/demo-user.dto";

type ListedUser = Readonly<{ id: string; name: string; role: UserRole }>;

const ROLE_ORDER: readonly UserRole[] = ["EMPLOYEE", "THERAPIST", "HR", "ADMIN"];
const NAME_LOCALE = "pt-BR";

const byRoleThenName = (first: ListedUser, second: ListedUser): number =>
  ROLE_ORDER.indexOf(first.role) - ROLE_ORDER.indexOf(second.role) ||
  first.name.localeCompare(second.name, NAME_LOCALE);

const capitalized = (text: string): string => text.charAt(0).toLocaleUpperCase(NAME_LOCALE) + text.slice(1);

const toDemoUser = ({ id, name, role }: ListedUser): DemoUserDto => {
  const spokenRole = messages.roles.spoken[role];
  return {
    id,
    name,
    firstName: firstNameOf(name),
    role,
    roleLabel: capitalized(spokenRole),
    spokenText: messages.demoUsers.spokenItem(name, spokenRole),
  };
};

@Injectable()
export class DemoUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listDemoUsers(): Promise<DemoUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, role: true },
    });
    return [...users].sort(byRoleThenName).map(toDemoUser);
  }
}
