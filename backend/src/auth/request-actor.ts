import type { UserRole, UserStatus } from "@prisma/client";
import type { Request } from "express";

export type RequestActor = Readonly<{ id: string; role: UserRole; name: string; email: string }>;

export type StoredActor = RequestActor & Readonly<{ status: UserStatus }>;

export type ActorRequest = Request & { actor?: RequestActor };

export function toRequestActor({ id, role, name, email }: StoredActor): RequestActor {
  return Object.freeze({ id, role, name, email });
}
