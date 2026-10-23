import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { BusinessRulesService } from "./business-rules.service";
import { UpdateBusinessRuleDto } from "./dto/update-business-rule.dto";

@Controller("business-rules")
@Roles("HR")
export class BusinessRulesController {
  constructor(private readonly businessRules: BusinessRulesService) {}

  @Get()
  list() {
    return this.businessRules.list();
  }

  @Patch(":key")
  update(@CurrentActor() actor: RequestActor, @Param("key") key: string, @Body() input: UpdateBusinessRuleDto) {
    return this.businessRules.update(actor.id, key, input.value);
  }
}
