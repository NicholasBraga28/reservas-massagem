import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PAIRING_CODE_SOURCE, PairingCodeSource } from "../../src/alexa/pairing-code-source";
import { AppModule } from "../../src/app.module";
import { AUTH_OPTIONS, AuthOptions } from "../../src/auth/auth-options";
import { CLOCK, Clock } from "../../src/common/clock/clock";
import type { AuthMode } from "../../src/config/env.validation";
import { configureApp } from "../../src/configure-app";
import { PrismaService } from "../../src/prisma/prisma.service";

export type TestApp = { app: INestApplication; prisma: PrismaService };
export type TestAppOptions = Readonly<{ clock?: Clock; authMode?: AuthMode; pairingCodeSource?: PairingCodeSource }>;

const authOptionsWithoutGoogleAccount = (mode: AuthMode): AuthOptions => ({
  mode,
  googleClientId: "",
  googleWorkspaceDomain: "",
});

export async function createTestApp({ clock, authMode, pairingCodeSource }: TestAppOptions = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (clock) builder.overrideProvider(CLOCK).useValue(clock);
  if (authMode) builder.overrideProvider(AUTH_OPTIONS).useValue(authOptionsWithoutGoogleAccount(authMode));
  if (pairingCodeSource) builder.overrideProvider(PAIRING_CODE_SOURCE).useValue(pairingCodeSource);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
