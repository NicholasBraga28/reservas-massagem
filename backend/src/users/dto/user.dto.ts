import type { UserRole, UserStatus } from "@prisma/client";

export type UserDto = Readonly<{
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  therapistId: string | null;
  createdAt: Date;
}>;
