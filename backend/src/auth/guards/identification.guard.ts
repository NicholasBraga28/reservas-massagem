import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { refuseAccess } from "../access-refusal";
import { ActorRequest, toRequestActor } from "../request-actor";
import { ACTOR_RESOLVER, ActorResolver } from "../resolvers/actor-resolver";
import { isPublicRoute } from "../route-metadata";

@Injectable()
export class IdentificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACTOR_RESOLVER) private readonly resolver: ActorResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) return true;
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const resolution = await this.resolver.resolve(request);
    if (resolution.outcome === "not_identified") throw refuseAccess({ request, reason: "not_identified" });
    if (resolution.outcome === "not_recognized") {
      throw refuseAccess({ request, reason: "not_recognized", userId: resolution.userId });
    }
    request.actor = toRequestActor(resolution.user);
    return true;
  }
}
