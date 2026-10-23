import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { ActorRequest, RequestActor } from "../request-actor";

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor | undefined =>
    context.switchToHttp().getRequest<ActorRequest>().actor,
);
