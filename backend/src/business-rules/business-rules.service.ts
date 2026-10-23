import { Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import {
  assertConsistentBusinessRules,
  BUSINESS_RULE_NAMES,
  BusinessRuleName,
  BusinessRules,
  businessRulesConfig,
  businessRuleType,
  formatBusinessRuleValue,
  InvalidBusinessRulesError,
  parameterName,
  ruleForParameter,
  withBusinessRuleValue,
} from "../config/business-rules.config";
import { messages } from "../messages/catalog";
import { BUSINESS_RULES_REPOSITORY, BusinessRulesRepository, BusinessRulesRevision } from "./business-rules.repository";
import { BusinessRuleDto } from "./dto/business-rule.dto";
import { InvalidBusinessRuleValueException } from "./invalid-business-rule-value.exception";

const UPDATE_AUDIT_ACTION = "BUSINESS_RULE_UPDATED";

export class BusinessRulesNotLoadedError extends Error {}

function assertConsistentStoredRules(storedRules: BusinessRules): void {
  try {
    assertConsistentBusinessRules(storedRules);
  } catch (error) {
    if (!(error instanceof InvalidBusinessRulesError)) throw error;
    throw new InvalidBusinessRulesError(
      error.violation,
      `Parâmetro de negócio inválido no banco (tabela business_rules): ${error.message}`,
    );
  }
}

type RuleUpdate = Readonly<{ actorId: string; rule: BusinessRuleName; value: string }>;

function revisionFor({ actorId, rule, value }: RuleUpdate, stored: BusinessRules): BusinessRulesRevision {
  const rules = withBusinessRuleValue(stored, rule, value);
  assertConsistentBusinessRules(rules);
  return {
    rules,
    auditEntry: {
      actorId,
      action: UPDATE_AUDIT_ACTION,
      entityId: parameterName(rule),
      data: { previousValue: formatBusinessRuleValue(stored, rule), newValue: formatBusinessRuleValue(rules, rule) },
    },
  };
}

@Injectable()
export class BusinessRulesService implements OnModuleInit {
  private rules?: BusinessRules;
  private pendingUpdate: Promise<void> = Promise.resolve();

  constructor(
    @Inject(businessRulesConfig.KEY) private readonly initialRules: BusinessRules,
    @Inject(BUSINESS_RULES_REPOSITORY) private readonly repository: BusinessRulesRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const storedRules = await this.loadStoredRules();
    assertConsistentStoredRules(storedRules);
    this.rules = storedRules;
  }

  current(): BusinessRules {
    if (!this.rules) throw new BusinessRulesNotLoadedError("Os parâmetros de negócio ainda não foram carregados.");
    return this.rules;
  }

  list(): BusinessRuleDto[] {
    return BUSINESS_RULE_NAMES.map((rule) => this.describe(rule));
  }

  async update(actorId: string, parameter: string, value: string): Promise<BusinessRuleDto> {
    const rule = ruleForParameter(parameter);
    if (!rule) throw new NotFoundException(messages.errors.businessRuleNotFound);
    const saved = this.pendingUpdate.then(async () => {
      this.rules = await this.reviseOrRefuse({ actorId, rule, value });
    });
    this.pendingUpdate = saved.catch(() => undefined);
    await saved;
    return this.describe(rule);
  }

  private async reviseOrRefuse(update: RuleUpdate): Promise<BusinessRules> {
    try {
      return await this.repository.revise((stored) => revisionFor(update, stored));
    } catch (error) {
      if (error instanceof InvalidBusinessRulesError) throw new InvalidBusinessRuleValueException(error.violation);
      throw error;
    }
  }

  private describe(rule: BusinessRuleName): BusinessRuleDto {
    return {
      key: parameterName(rule),
      value: formatBusinessRuleValue(this.current(), rule),
      type: businessRuleType(rule),
      description: messages.businessRules.parameters[rule].description,
    };
  }

  private async loadStoredRules(): Promise<BusinessRules> {
    const existingRules = await this.repository.findCurrent();
    if (existingRules) return existingRules;
    await this.repository.insertInitialIfMissing(this.initialRules);
    const insertedRules = await this.repository.findCurrent();
    if (!insertedRules) throw new BusinessRulesNotLoadedError("Os parâmetros de negócio não foram gravados no banco.");
    return insertedRules;
  }
}
