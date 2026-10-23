import { BadRequestException } from "@nestjs/common";
import { BusinessRuleName, BusinessRuleViolation, businessRuleType } from "../config/business-rules.config";
import { messages } from "../messages/catalog";

const { parameters, units, violations } = messages.businessRules;

const labelOf = (rule: BusinessRuleName): string => parameters[rule].label;

const subjectOf = (rule: BusinessRuleName): string => {
  const label = labelOf(rule);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const contractedWithDe = (rule: BusinessRuleName): string => `d${labelOf(rule)}`;

function describeViolation(violation: BusinessRuleViolation): string {
  const subject = subjectOf(violation.rule);
  switch (violation.kind) {
    case "MISSING":
      return violations.MISSING(labelOf(violation.rule));
    case "OUT_OF_LIMITS":
      return violations.OUT_OF_LIMITS(subject, violation.min, violation.max, units[businessRuleType(violation.rule)]);
    case "NOT_AFTER":
    case "NOT_BEFORE":
    case "BEFORE":
      return violations[violation.kind](subject, contractedWithDe(violation.other));
    default:
      return violations[violation.kind](subject);
  }
}

export class InvalidBusinessRuleValueException extends BadRequestException {
  constructor(violation: BusinessRuleViolation) {
    super(describeViolation(violation));
  }
}
