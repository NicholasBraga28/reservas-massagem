import { UserRole } from "@prisma/client";
import { effectiveRolesOf, canActAs } from "./role-inheritance";

const ROLES = Object.values(UserRole);

const EXPECTED_EFFECTIVE_ROLES: ReadonlyArray<[UserRole, UserRole[]]> = [
  ["EMPLOYEE", ["EMPLOYEE"]],
  ["THERAPIST", ["THERAPIST"]],
  ["HR", ["HR"]],
  ["ADMIN", ["ADMIN", "HR"]],
];

const isGranted = (role: UserRole, required: UserRole) =>
  EXPECTED_EFFECTIVE_ROLES.some(([granted, effective]) => granted === role && effective.includes(required));

const EVERY_ROLE_PAIR = ROLES.flatMap((role) =>
  ROLES.map((required) => ({ role, required, expected: isGranted(role, required) })),
);

describe("role-inheritance", () => {
  it("TK-02.01: covers 4 roles x 4 required roles", () => {
    expect(ROLES).toHaveLength(4);
    expect(EVERY_ROLE_PAIR).toHaveLength(16);
  });

  it.each(EXPECTED_EFFECTIVE_ROLES)("TK-02.01: %s has the effective roles %j", (role, expected) => {
    expect(effectiveRolesOf(role)).toEqual(expected);
  });

  it.each(EVERY_ROLE_PAIR)("TK-02.01: $role can act as [$required] is $expected", ({ role, required, expected }) => {
    expect(canActAs(role, [required])).toBe(expected);
  });

  it("TK-02.01: lets ADMIN act as HR by inheritance", () => {
    expect(canActAs("ADMIN", ["HR"])).toBe(true);
  });

  it("TK-02.01: refuses HR where ADMIN is required", () => {
    expect(canActAs("HR", ["ADMIN"])).toBe(false);
  });

  it("TK-02.01: refuses ADMIN where only EMPLOYEE or THERAPIST is required", () => {
    expect(canActAs("ADMIN", ["EMPLOYEE"])).toBe(false);
    expect(canActAs("ADMIN", ["THERAPIST"])).toBe(false);
    expect(canActAs("ADMIN", ["EMPLOYEE", "THERAPIST"])).toBe(false);
  });

  it("TK-02.01: accepts a role listed among several required roles", () => {
    expect(canActAs("THERAPIST", ["EMPLOYEE", "THERAPIST"])).toBe(true);
  });

  it("TK-02.01: refuses every role when no role is required", () => {
    expect(ROLES.filter((role) => canActAs(role, []))).toEqual([]);
  });
});
