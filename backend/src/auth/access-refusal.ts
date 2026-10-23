import { ForbiddenException, HttpException, Logger, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { messages } from "../messages/catalog";

export type AccessRefusalReason = "not_identified" | "not_recognized" | "role_not_allowed";

export type AccessRefusal = Readonly<{ request: Request; reason: AccessRefusalReason; userId?: string }>;

type MatchedRoute = Readonly<{ path?: string }>;

const NO_USER_ID = "none";
const UNMATCHED_ROUTE = "unmatched";

const logger = new Logger("AccessControl");

const refusalExceptions: Readonly<Record<AccessRefusalReason, () => HttpException>> = {
  not_identified: () => new UnauthorizedException(messages.errors.notIdentified),
  not_recognized: () => new UnauthorizedException(messages.errors.identificationNotRecognized),
  role_not_allowed: () => new ForbiddenException(messages.errors.accessDenied),
};

const routePatternOf = (request: Request): string =>
  (request.route as MatchedRoute | undefined)?.path ?? UNMATCHED_ROUTE;

export function refuseAccess({ request, reason, userId }: AccessRefusal): HttpException {
  logger.warn(
    `Access refused: method=${request.method} route=${routePatternOf(request)} reason=${reason} userId=${userId ?? NO_USER_ID}`,
  );
  return refusalExceptions[reason]();
}
