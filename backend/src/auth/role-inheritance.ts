import type { UserRole } from "@prisma/client";

const EFFECTIVE_ROLES: Readonly<Record<UserRole, readonly UserRole[]>> = Object.freeze({
  EMPLOYEE: ["EMPLOYEE"],
  THERAPIST: ["THERAPIST"],
  HR: ["HR"],
  ADMIN: ["ADMIN", "HR"],
});

export function effectiveRolesOf(role: UserRole): UserRole[] {
  return [...EFFECTIVE_ROLES[role]];
}

export function canActAs(role: UserRole, requiredRoles: readonly UserRole[]): boolean {
  return EFFECTIVE_ROLES[role].some((effectiveRole) => requiredRoles.includes(effectiveRole));
}
