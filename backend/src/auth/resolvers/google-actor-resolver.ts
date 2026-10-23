import type { Request } from "express";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthOptions } from "../auth-options";
import { ActorResolution, ActorResolver, STORED_ACTOR_SELECT, resolutionFor } from "./actor-resolver";

const BEARER_PREFIX = "Bearer ";

export class GoogleActorResolver implements ActorResolver {
  private readonly google = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly options: AuthOptions,
  ) {}

  async resolve(request: Request): Promise<ActorResolution> {
    const token = this.bearerToken(request);
    if (!token || !this.options.googleClientId) return { outcome: "not_identified" };
    const googleSubject = await this.verifiedGoogleSubject(token);
    if (!googleSubject) return { outcome: "not_recognized" };
    const user = await this.prisma.user.findUnique({ where: { googleSubject }, select: STORED_ACTOR_SELECT });
    return resolutionFor(user);
  }

  private bearerToken(request: Request): string {
    const authorization = request.header("authorization");
    return authorization?.startsWith(BEARER_PREFIX) ? authorization.slice(BEARER_PREFIX.length).trim() : "";
  }

  private async verifiedGoogleSubject(token: string): Promise<string | undefined> {
    try {
      const ticket = await this.google.verifyIdToken({ idToken: token, audience: this.options.googleClientId });
      const payload = ticket.getPayload();
      return payload && this.isFromAllowedWorkspace(payload) ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }

  private isFromAllowedWorkspace(payload: TokenPayload): boolean {
    const workspaceDomain = this.options.googleWorkspaceDomain;
    return !workspaceDomain || payload.hd === workspaceDomain;
  }
}
