import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BusinessRules } from "../config/business-rules.config";
import { PrismaService } from "../prisma/prisma.service";
import {
  BusinessRulesRepository,
  BusinessRulesRevision,
  BusinessRulesRowMissingError,
} from "./business-rules.repository";

const SINGLE_ROW_ID = 1;
const AUDIT_ENTITY = "BusinessRules";

const BUSINESS_RULE_COLUMNS = {
  bookingMinNoticeMinutes: true,
  cancellationMinNoticeMinutes: true,
  lateArrivalToleranceMinutes: true,
  checkInEarlyMinutes: true,
  reminderLeadMinutes: true,
  reminderConfirmationToleranceMinutes: true,
  waitlistAcceptanceMinutes: true,
  sessionDurationMinutes: true,
  slotStepMinutes: true,
  bookingHorizonDays: true,
  maxActiveBookingsPerEmployee: true,
  workDays: true,
  workStartMinutes: true,
  lunchStartMinutes: true,
  lunchEndMinutes: true,
  workEndMinutes: true,
} as const satisfies Record<keyof BusinessRules, true>;

const toRow = (rules: BusinessRules) => ({ ...rules, workDays: [...rules.workDays] });

@Injectable()
export class PrismaBusinessRulesRepository implements BusinessRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrent(): Promise<BusinessRules | null> {
    return this.prisma.businessRules.findUnique({ where: { id: SINGLE_ROW_ID }, select: BUSINESS_RULE_COLUMNS });
  }

  async insertInitialIfMissing(initialRules: BusinessRules): Promise<void> {
    await this.prisma.businessRules.createMany({
      data: { ...toRow(initialRules), id: SINGLE_ROW_ID },
      skipDuplicates: true,
    });
  }

  revise(buildRevision: (stored: BusinessRules) => BusinessRulesRevision): Promise<BusinessRules> {
    return this.prisma.$transaction(async (transaction) => {
      const stored = await this.findLocked(transaction);
      const { rules, auditEntry } = buildRevision(stored);
      await transaction.businessRules.update({ where: { id: SINGLE_ROW_ID }, data: toRow(rules) });
      await transaction.auditEvent.create({ data: { ...auditEntry, entityType: AUDIT_ENTITY } });
      return rules;
    });
  }

  private async findLocked(transaction: Prisma.TransactionClient): Promise<BusinessRules> {
    await transaction.$queryRaw`SELECT id FROM business_rules WHERE id = ${SINGLE_ROW_ID} FOR UPDATE`;
    const stored = await transaction.businessRules.findUnique({
      where: { id: SINGLE_ROW_ID },
      select: BUSINESS_RULE_COLUMNS,
    });
    if (!stored) throw new BusinessRulesRowMissingError("A linha de parâmetros de negócio não existe no banco.");
    return stored;
  }
}
