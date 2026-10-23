import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { messages } from "../messages/catalog";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { QueryUsersDto } from "./dto/query-users.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UserDto } from "./dto/user.dto";
import { UserEmailAlreadyExistsException } from "./user-email-already-exists.exception";

const UNIQUE_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";

const STATUS_AUDIT_ACTIONS: Readonly<Record<UserStatus, string>> = {
  ACTIVE: "USER_ACTIVATED",
  INACTIVE: "USER_DEACTIVATED",
};

const hasPrismaCode = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const isUniqueViolation = (error: unknown): boolean => hasPrismaCode(error, UNIQUE_VIOLATION);

const isRecordNotFound = (error: unknown): boolean => hasPrismaCode(error, RECORD_NOT_FOUND);

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  therapist: { select: { id: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const NAME_LOCALE = "pt-BR";

const byName = (first: SelectedUser, second: SelectedUser): number =>
  first.name.localeCompare(second.name, NAME_LOCALE);

const matchingNameOrEmail = (search: string): Prisma.UserWhereInput[] => [
  { name: { contains: search, mode: "insensitive" } },
  { email: { contains: search, mode: "insensitive" } },
];

const toUserDto = ({ therapist, ...user }: SelectedUser): UserDto => ({
  ...user,
  therapistId: therapist?.id ?? null,
});

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list({ role, status, search }: QueryUsersDto): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { role, status, OR: search ? matchingNameOrEmail(search) : undefined },
      select: USER_SELECT,
    });
    return users.sort(byName).map(toUserDto);
  }

  async create(actorId: string, input: CreateUserDto): Promise<UserDto> {
    const user = await this.createUserWithTherapistProfile(input);
    await this.audit.record(actorId, "USER_CREATED", "User", user.id, { role: user.role });
    return toUserDto(user);
  }

  async changeStatus(actorId: string, userId: string, { status }: UpdateUserStatusDto): Promise<UserDto> {
    const user = await this.updateStatusOrFail(userId, status);
    await this.audit.record(actorId, STATUS_AUDIT_ACTIONS[status], "User", user.id);
    return toUserDto(user);
  }

  private async updateStatusOrFail(userId: string, status: UserStatus): Promise<SelectedUser> {
    try {
      return await this.prisma.user.update({ where: { id: userId }, data: { status }, select: USER_SELECT });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException(messages.errors.userNotFound);
      throw error;
    }
  }

  private async createUserWithTherapistProfile(input: CreateUserDto): Promise<SelectedUser> {
    const isTherapist = input.role === "THERAPIST";
    try {
      return await this.prisma.user.create({
        data: { ...input, therapist: isTherapist ? { create: {} } : undefined },
        select: USER_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new UserEmailAlreadyExistsException();
      throw error;
    }
  }
}
