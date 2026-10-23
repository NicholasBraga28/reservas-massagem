import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AUTH_OPTIONS, AuthOptions, isHeaderMode } from "../auth-options";
import { RouteNotFoundException } from "../route-not-found.exception";

@Injectable()
export class HeaderModeOnlyGuard implements CanActivate {
  constructor(@Inject(AUTH_OPTIONS) private readonly options: AuthOptions) {}

  canActivate(context: ExecutionContext): boolean {
    if (isHeaderMode(this.options)) return true;
    throw new RouteNotFoundException(context.switchToHttp().getRequest<Request>());
  }
}
