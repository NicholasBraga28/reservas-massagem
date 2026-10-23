import { Prisma } from "@prisma/client";
import { BusinessRules } from "../config/business-rules.config";

export type BusinessRulesAuditEntry = Readonly<{
  actorId: string;
  action: string;
  entityId: string;
  data: Prisma.InputJsonObject;
}>;

export type BusinessRulesRevision = Readonly<{ rules: BusinessRules; auditEntry: BusinessRulesAuditEntry }>;

export class BusinessRulesRowMissingError extends Error {}

export interface BusinessRulesRepository {
  findCurrent(): Promise<BusinessRules | null>;
  insertInitialIfMissing(initialRules: BusinessRules): Promise<void>;
  revise(buildRevision: (stored: BusinessRules) => BusinessRulesRevision): Promise<BusinessRules>;
}

export const BUSINESS_RULES_REPOSITORY = Symbol("BUSINESS_RULES_REPOSITORY");
