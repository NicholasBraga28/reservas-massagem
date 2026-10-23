import type { UserRole } from "@prisma/client";

export type ProfileDto = Readonly<{
  id: string;
  role: UserRole;
  effectiveRoles: UserRole[];
  name: string;
  firstName: string;
  therapistId: string | null;
  spokenText: string;
}>;
