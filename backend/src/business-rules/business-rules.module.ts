import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { businessRulesConfig } from "../config/business-rules.config";
import { PrismaModule } from "../prisma/prisma.module";
import { BusinessRulesController } from "./business-rules.controller";
import { BUSINESS_RULES_REPOSITORY } from "./business-rules.repository";
import { BusinessRulesService } from "./business-rules.service";
import { PrismaBusinessRulesRepository } from "./prisma-business-rules.repository";

@Global()
@Module({
  imports: [ConfigModule.forFeature(businessRulesConfig), PrismaModule],
  controllers: [BusinessRulesController],
  providers: [BusinessRulesService, { provide: BUSINESS_RULES_REPOSITORY, useClass: PrismaBusinessRulesRepository }],
  exports: [BusinessRulesService],
})
export class BusinessRulesModule {}
