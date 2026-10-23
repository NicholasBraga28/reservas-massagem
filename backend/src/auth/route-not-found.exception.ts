import { NotFoundException } from "@nestjs/common";
import type { Request } from "express";

export class RouteNotFoundException extends NotFoundException {
  constructor(request: Request) {
    super(`Cannot ${request.method} ${request.originalUrl}`);
  }
}
