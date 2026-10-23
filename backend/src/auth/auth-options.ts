import { ConfigService } from "@nestjs/config";
import type { AuthMode } from "../config/env.validation";

export const AUTH_OPTIONS = "AUTH_OPTIONS";

export type AuthOptions = Readonly<{
  mode: AuthMode;
  googleClientId: string;
  googleWorkspaceDomain: string;
}>;

const DEFAULT_AUTH_MODE: AuthMode = "header";

export function authOptionsFrom(config: ConfigService): AuthOptions {
  return {
    mode: config.get<AuthMode>("AUTH_MODE") || DEFAULT_AUTH_MODE,
    googleClientId: config.get<string>("GOOGLE_CLIENT_ID")?.trim() ?? "",
    googleWorkspaceDomain: config.get<string>("GOOGLE_WORKSPACE_DOMAIN")?.trim() ?? "",
  };
}

export function isHeaderMode(options: AuthOptions): boolean {
  return options.mode === "header";
}
