import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { TenantLicenseGuard } from "../core/tenancy/tenant-license.guard";
import { ContentService } from "./content.service";
import { CreateContentRequestDto } from "./create-content-request.dto";

@Controller()
@UseGuards(TenantLicenseGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post("generate-content")
  generateContent(@Body() dto: CreateContentRequestDto) {
    return this.contentService.generateContent(dto);
  }

  @Get("contents")
  listContents(@Query("take") take?: string, @Query("tenantId") tenantId?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return this.contentService.listContents(limit, tenantId);
  }
}
