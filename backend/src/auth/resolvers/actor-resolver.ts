import type { Request } from "express";
import type { StoredActor } from "../request-actor";

export const ACTOR_RESOLVER = "ACTOR_RESOLVER";

export const STORED_ACTOR_SELECT = { id: true, role: true, name: true, email: true, status: true } as const;

export type ActorResolution =
  | Readonly<{ outcome: "not_identified" }>
  | Readonly<{ outcome: "not_recognized"; userId?: string }>
  | Readonly<{ outcome: "resolved"; user: StoredActor }>;

export interface ActorResolver {
  resolve(request: Request): Promise<ActorResolution>;
}

export function resolutionFor(user: StoredActor | null, requestedUserId?: string): ActorResolution {
  if (!user) return { outcome: "not_recognized", userId: requestedUserId };
  if (user.status !== "ACTIVE") return { outcome: "not_recognized", userId: user.id };
  return { outcome: "resolved", user };
}
