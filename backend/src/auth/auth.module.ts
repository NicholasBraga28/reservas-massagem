import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_OPTIONS, AuthOptions, authOptionsFrom, isHeaderMode } from "./auth-options";
import { IdentificationGuard } from "./guards/identification.guard";
import { RolesGuard } from "./guards/roles.guard";
import { ACTOR_RESOLVER, ActorResolver } from "./resolvers/actor-resolver";
import { GoogleActorResolver } from "./resolvers/google-actor-resolver";
import { HeaderActorResolver } from "./resolvers/header-actor-resolver";
import { AuthController } from "./auth.controller";
import { DemoUsersService } from "./demo-users.service";
import { MeController } from "./me.controller";
import { ProfileService } from "./profile.service";

const createActorResolver = (options: AuthOptions, prisma: PrismaService): ActorResolver =>
  isHeaderMode(options) ? new HeaderActorResolver(prisma) : new GoogleActorResolver(prisma, options);

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MeController],
  providers: [
    ProfileService,
    DemoUsersService,
    { provide: AUTH_OPTIONS, inject: [ConfigService], useFactory: authOptionsFrom },
    { provide: ACTOR_RESOLVER, inject: [AUTH_OPTIONS, PrismaService], useFactory: createActorResolver },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: IdentificationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
