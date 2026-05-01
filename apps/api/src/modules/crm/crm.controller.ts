import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ok } from "../../core/http/api-response";
import { CrmService } from "./crm.service";
import type { DealStatusUpdateInput } from "../funnel/funnel.types";

@Controller("crm")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get("deals")
  async deals(@Query("workspaceId") workspaceId?: string, @Query("take") take?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return ok(await this.crmService.listDeals(workspaceId, limit));
  }

  @Get("deals/:id")
  async deal(@Param("id") id: string) {
    return ok(await this.crmService.getDeal(id));
  }

  @Patch("deals/:id/status")
  async updateStatus(@Param("id") id: string, @Body() body: DealStatusUpdateInput) {
    return ok(await this.crmService.updateDealStatus(id, body));
  }
}
