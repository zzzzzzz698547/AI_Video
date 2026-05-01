import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TenantLicenseGuard } from "../core/tenancy/tenant-license.guard";
import { PublishingService } from "./publishing.service";
import { CreatePublishJobDto } from "./publishing.dto";

@Controller()
@UseGuards(TenantLicenseGuard)
export class PublishingController {
  constructor(private readonly publishingService: PublishingService) {}

  @Post("publish")
  createPublishJob(@Body() dto: CreatePublishJobDto) {
    return this.publishingService.createPublishJob(dto);
  }

  @Get("publish/:id")
  getPublishJob(@Param("id") id: string) {
    return this.publishingService.getPublishJob(id);
  }

  @Get("publishes")
  listPublishes(@Query("take") take?: string, @Query("tenantId") tenantId?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return this.publishingService.listPublishes(limit, tenantId);
  }

  @Post("retry/:id")
  retryJob(@Param("id") id: string) {
    return this.publishingService.retryJob(id);
  }
}
