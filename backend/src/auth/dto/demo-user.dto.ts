import type { UserRole } from "@prisma/client";

export type DemoUserDto = Readonly<{
  id: string;
  name: string;
  firstName: string;
  role: UserRole;
  roleLabel: string;
  spokenText: string;
}>;
