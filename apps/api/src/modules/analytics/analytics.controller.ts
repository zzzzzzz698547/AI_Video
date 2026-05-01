import { Controller, Get, Param, Query } from "@nestjs/common";
import { ok } from "../../core/http/api-response";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  async dashboard(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    const data = await this.analyticsService.dashboard({ workspaceId, brandId });
    return ok(data);
  }

  @Get("content/:id")
  async content(@Param("id") id: string) {
    return ok(await this.analyticsService.content(id));
  }

  @Get("top")
  async top(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    return ok(await this.analyticsService.top({ workspaceId, brandId }));
  }

  @Get("trends")
  async trends(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    return ok(await this.analyticsService.trends({ workspaceId, brandId }));
  }

  @Get("suggestions")
  async suggestions(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    return ok(await this.analyticsService.suggestions({ workspaceId, brandId }));
  }

  @Get("optimization-context")
  async optimizationContext(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    return ok(await this.analyticsService.optimizationContext({ workspaceId, brandId }));
  }
}
