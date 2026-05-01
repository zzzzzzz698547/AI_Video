import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TenantLicenseGuard } from "../../core/tenancy/tenant-license.guard";
import { AnalyzeVideoUrlDto } from "./analyze-video-url.dto";
import { UrlAnalysisService } from "./url-analysis.service";
import { VerifyVideoUrlDto } from "./verify-video-url.dto";

@Controller("url-analysis")
@UseGuards(TenantLicenseGuard)
export class UrlAnalysisController {
  constructor(private readonly urlAnalysisService: UrlAnalysisService) {}

  @Post("analyze")
  analyze(@Body() dto: AnalyzeVideoUrlDto) {
    return this.urlAnalysisService.analyze(dto);
  }

  @Post("verify")
  verify(@Body() dto: VerifyVideoUrlDto) {
    return this.urlAnalysisService.verify(dto);
  }

  @Get("analyses")
  list(@Query("take") take?: string, @Query("tenantId") tenantId?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(50, Number(take))) : 20;
    return this.urlAnalysisService.listAnalyses(limit, tenantId);
  }

  @Get("analyses/:id")
  get(@Param("id") id: string) {
    return this.urlAnalysisService.getAnalysis(id);
  }
}
