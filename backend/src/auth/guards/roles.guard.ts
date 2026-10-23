import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { refuseAccess } from "../access-refusal";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ActorRequest } from "../request-actor";
import { canActAs } from "../role-inheritance";
import { isPublicRoute, routeMetadata } from "../route-metadata";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) return true;
    const requiredRoles = routeMetadata<UserRole[]>(this.reflector, ROLES_KEY, context);
    if (!requiredRoles?.length) return true;
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const { actor } = request;
    if (!actor) throw refuseAccess({ request, reason: "not_identified" });
    if (!canActAs(actor.role, requiredRoles)) {
      throw refuseAccess({ request, reason: "role_not_allowed", userId: actor.id });
    }
    return true;
  }
}
