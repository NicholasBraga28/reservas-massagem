import { AppointmentStatus } from "@prisma/client";
import {
  FINAL_STATUSES,
  SLOT_OCCUPYING_STATUSES,
  StatusTransition,
  StatusTransitionActor,
  assertTransitionAllowed,
  isTransitionAllowed,
} from "./appointment-status";
import { messages } from "../messages/catalog";
import { InvalidStatusTransitionException } from "./invalid-status-transition.exception";

const HR_OR_ADMIN: StatusTransitionActor[] = ["HR", "ADMIN"];

const TRANSITION_TABLE: ReadonlyArray<[AppointmentStatus, AppointmentStatus, StatusTransitionActor[]]> = [
  ["BOOKED", "CONFIRMED", ["EMPLOYEE"]],
  ["BOOKED", "CANCELLED", ["EMPLOYEE", "THERAPIST", ...HR_OR_ADMIN]],
  ["BOOKED", "RELEASED", ["SYSTEM"]],
  ["CONFIRMED", "CHECKED_IN", ["EMPLOYEE"]],
  ["CONFIRMED", "IN_PROGRESS", ["THERAPIST"]],
  ["CONFIRMED", "POSSIBLE_NO_SHOW", ["SYSTEM"]],
  ["CONFIRMED", "CANCELLED", ["EMPLOYEE", "THERAPIST", ...HR_OR_ADMIN]],
  ["CHECKED_IN", "IN_PROGRESS", ["THERAPIST"]],
  ["POSSIBLE_NO_SHOW", "IN_PROGRESS", ["THERAPIST"]],
  ["POSSIBLE_NO_SHOW", "NO_SHOW", ["THERAPIST"]],
  ["IN_PROGRESS", "COMPLETED", ["THERAPIST", "SYSTEM"]],
  ["CHECKED_IN", "COMPLETED", ["SYSTEM"]],
];

const APPOINTMENT_ID = "6f1c2b9e-0d3a-4c1e-9b7a-1a2b3c4d5e6f";
const ACTORS: StatusTransitionActor[] = ["EMPLOYEE", "THERAPIST", "HR", "ADMIN", "SYSTEM"];
const STATUSES = Object.values(AppointmentStatus);

const allowedTransitions: StatusTransition[] = TRANSITION_TABLE.flatMap(([from, to, actors]) =>
  actors.map((actor) => ({ from, to, actor })),
);

const isListedInTable = ({ from, to, actor }: StatusTransition) =>
  allowedTransitions.some((allowed) => allowed.from === from && allowed.to === to && allowed.actor === actor);

const refusedTransitions: StatusTransition[] = STATUSES.flatMap((from) =>
  STATUSES.flatMap((to) => ACTORS.map((actor) => ({ from, to, actor }))),
).filter((transition) => !isListedInTable(transition));

describe("appointment-status", () => {
  it("RN-12: every status except CANCELLED and RELEASED occupies the slot", () => {
    expect([...SLOT_OCCUPYING_STATUSES].sort()).toEqual(
      ["BOOKED", "CHECKED_IN", "COMPLETED", "CONFIRMED", "IN_PROGRESS", "NO_SHOW", "POSSIBLE_NO_SHOW"].sort(),
    );
  });

  it("Máquina de estados: COMPLETED, CANCELLED, RELEASED and NO_SHOW are the final statuses", () => {
    expect([...FINAL_STATUSES].sort()).toEqual(["CANCELLED", "COMPLETED", "NO_SHOW", "RELEASED"].sort());
  });

  it("Máquina de estados: covers 9 statuses x 9 statuses x 5 actors", () => {
    expect(STATUSES).toHaveLength(9);
    expect(allowedTransitions.length + refusedTransitions.length).toBe(9 * 9 * 5);
  });

  it.each(allowedTransitions)("Máquina de estados: allows $from -> $to by $actor", (transition) => {
    expect(isTransitionAllowed(transition)).toBe(true);
    expect(() => assertTransitionAllowed(APPOINTMENT_ID, transition)).not.toThrow();
  });

  it.each(refusedTransitions)("Máquina de estados: refuses $from -> $to by $actor", (transition) => {
    expect(isTransitionAllowed(transition)).toBe(false);
    expect(() => assertTransitionAllowed(APPOINTMENT_ID, transition)).toThrow(InvalidStatusTransitionException);
  });

  it("RF-14: allows the therapist to start a confirmed appointment without check-in", () => {
    expect(isTransitionAllowed({ from: "CONFIRMED", to: "IN_PROGRESS", actor: "THERAPIST" })).toBe(true);
  });

  it("RF-14: refuses the employee starting a confirmed appointment", () => {
    expect(isTransitionAllowed({ from: "CONFIRMED", to: "IN_PROGRESS", actor: "EMPLOYEE" })).toBe(false);
  });

  it("RN-16: allows the system to complete an in-progress appointment", () => {
    expect(isTransitionAllowed({ from: "IN_PROGRESS", to: "COMPLETED", actor: "SYSTEM" })).toBe(true);
  });

  it("Máquina de estados: allows ADMIN to cancel a confirmed appointment, like HR", () => {
    expect(isTransitionAllowed({ from: "CONFIRMED", to: "CANCELLED", actor: "ADMIN" })).toBe(true);
    expect(isTransitionAllowed({ from: "CONFIRMED", to: "CANCELLED", actor: "HR" })).toBe(true);
  });

  it("TK-05.05 D-06 RN-16: allows the system to complete a checked-in appointment that never started", () => {
    expect(isTransitionAllowed({ from: "CHECKED_IN", to: "COMPLETED", actor: "SYSTEM" })).toBe(true);
  });

  it.each(["COMPLETED", "CANCELLED", "RELEASED", "NO_SHOW"] as AppointmentStatus[])(
    "Máquina de estados: rejects leaving the final status %s",
    (from) => {
      const leavingTransitions = STATUSES.flatMap((to) => ACTORS.map((actor) => ({ from, to, actor })));
      expect(leavingTransitions.filter(isTransitionAllowed)).toEqual([]);
    },
  );

  it.each(STATUSES)("Máquina de estados: rejects a transition from %s to itself", (status) => {
    expect(ACTORS.filter((actor) => isTransitionAllowed({ from: status, to: status, actor }))).toEqual([]);
  });

  describe("InvalidStatusTransitionException", () => {
    const refuse = () => {
      let refused: unknown;
      try {
        assertTransitionAllowed(APPOINTMENT_ID, { from: "CHECKED_IN", to: "CANCELLED", actor: "EMPLOYEE" });
      } catch (error) {
        refused = error;
      }
      expect(refused).toBeInstanceOf(InvalidStatusTransitionException);
      return refused as InvalidStatusTransitionException;
    };

    it("Máquina de estados: answers 409 with the catalog message, in Portuguese, without status names or codes", () => {
      const exception = refuse();

      expect(exception.getStatus()).toBe(409);
      expect(exception.message).toBe(messages.errors.invalidStatusTransition);
      expect(exception.message).toBe(
        "Esta ação não está disponível para este atendimento agora. Consulte a agenda para ver a situação dele.",
      );
      expect(exception.message).not.toMatch(/[A-Z]{2,}|_|\d/);
    });

    it("Máquina de estados: keeps the refused transition and the appointment ID for the log", () => {
      expect(refuse().transition).toEqual({
        appointmentId: APPOINTMENT_ID,
        from: "CHECKED_IN",
        to: "CANCELLED",
        actor: "EMPLOYEE",
      });
    });
  });
});
