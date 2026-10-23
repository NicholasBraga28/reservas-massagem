import type { BusinessRuleType } from "../../config/business-rules.config";

export type BusinessRuleDto = Readonly<{
  key: string;
  value: string;
  type: BusinessRuleType;
  description: string;
}>;
