import type { AppointmentStatus, UserRole } from "@prisma/client";
import { canActAs } from "../auth/role-inheritance";
import { InvalidStatusTransitionException } from "./invalid-status-transition.exception";

export const SLOT_OCCUPYING_STATUSES: readonly AppointmentStatus[] = Object.freeze([
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "POSSIBLE_NO_SHOW",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
]);

export const ACTIVE_STATUSES: readonly AppointmentStatus[] = Object.freeze([
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "POSSIBLE_NO_SHOW",
  "IN_PROGRESS",
]);

export const FINAL_STATUSES: readonly AppointmentStatus[] = Object.freeze([
  "COMPLETED",
  "CANCELLED",
  "RELEASED",
  "NO_SHOW",
]);

export type StatusTransitionActor = "EMPLOYEE" | "THERAPIST" | "HR" | "ADMIN" | "SYSTEM";

export type StatusTransition = Readonly<{
  from: AppointmentStatus;
  to: AppointmentStatus;
  actor: StatusTransitionActor;
}>;

const TRANSITIONS: ReadonlyArray<
  Readonly<{ from: AppointmentStatus; to: AppointmentStatus; actors: readonly StatusTransitionActor[] }>
> = [
  { from: "BOOKED", to: "CONFIRMED", actors: ["EMPLOYEE"] },
  { from: "BOOKED", to: "CANCELLED", actors: ["EMPLOYEE", "THERAPIST", "HR"] },
  { from: "BOOKED", to: "RELEASED", actors: ["SYSTEM"] },
  { from: "CONFIRMED", to: "CHECKED_IN", actors: ["EMPLOYEE"] },
  { from: "CONFIRMED", to: "IN_PROGRESS", actors: ["THERAPIST"] },
  { from: "CONFIRMED", to: "POSSIBLE_NO_SHOW", actors: ["SYSTEM"] },
  { from: "CONFIRMED", to: "CANCELLED", actors: ["EMPLOYEE", "THERAPIST", "HR"] },
  { from: "CHECKED_IN", to: "IN_PROGRESS", actors: ["THERAPIST"] },
  { from: "POSSIBLE_NO_SHOW", to: "IN_PROGRESS", actors: ["THERAPIST"] },
  { from: "POSSIBLE_NO_SHOW", to: "NO_SHOW", actors: ["THERAPIST"] },
  { from: "IN_PROGRESS", to: "COMPLETED", actors: ["THERAPIST", "SYSTEM"] },
  { from: "CHECKED_IN", to: "COMPLETED", actors: ["SYSTEM"] },
];

const isUserRole = (actor: StatusTransitionActor): actor is UserRole => actor !== "SYSTEM";

const isActorAllowed = (actor: StatusTransitionActor, allowedActors: readonly StatusTransitionActor[]): boolean =>
  isUserRole(actor) ? canActAs(actor, allowedActors.filter(isUserRole)) : allowedActors.includes(actor);

export function isTransitionAllowed({ from, to, actor }: StatusTransition): boolean {
  return TRANSITIONS.some(
    (transition) => transition.from === from && transition.to === to && isActorAllowed(actor, transition.actors),
  );
}

export function assertTransitionAllowed(appointmentId: string, transition: StatusTransition): void {
  if (!isTransitionAllowed(transition)) throw new InvalidStatusTransitionException({ appointmentId, ...transition });
}
