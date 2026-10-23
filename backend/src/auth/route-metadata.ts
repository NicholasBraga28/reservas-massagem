import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator";

export function routeMetadata<T>(reflector: Reflector, key: string, context: ExecutionContext): T | undefined {
  return reflector.getAllAndOverride<T | undefined>(key, [context.getHandler(), context.getClass()]);
}

export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return routeMetadata<boolean>(reflector, IS_PUBLIC_KEY, context) === true;
}
