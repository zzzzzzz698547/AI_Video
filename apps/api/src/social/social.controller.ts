import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentTenant, type CurrentTenantPayload } from "../core/tenancy/current-tenant.decorator";
import { TenantLicenseGuard } from "../core/tenancy/tenant-license.guard";
import { CreateSocialPublishJobDto } from "./dto/create-social-publish-job.dto";
import { SocialService } from "./social.service";

@Controller()
@UseGuards(TenantLicenseGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get("api/social/adapters")
  listAdapters(@Query("tenantId") tenantId?: string, @CurrentTenant() currentTenant?: CurrentTenantPayload | null) {
    return this.socialService.listAdapters(tenantId ?? currentTenant?.tenantId ?? "");
  }

  @Delete("api/social/adapters/:id")
  deleteAdapter(@Param("id") id: string) {
    return this.socialService.deleteAdapter(id);
  }

  @Post("api/videos/:videoId/publish/social")
  createPublishJob(
    @Param("videoId") videoId: string,
    @Body() dto: CreateSocialPublishJobDto,
    @CurrentTenant() currentTenant?: CurrentTenantPayload | null
  ) {
    return this.socialService.createPublishJob(videoId, dto, currentTenant);
  }

  @Get("api/videos/:videoId/publish/jobs")
  listVideoJobs(
    @Param("videoId") videoId: string,
    @Query("tenantId") tenantId?: string,
    @CurrentTenant() currentTenant?: CurrentTenantPayload | null
  ) {
    return this.socialService.listVideoJobs(videoId, tenantId, currentTenant);
  }

  @Post("api/social/publish-jobs/:jobId/retry")
  retryPublishJob(@Param("jobId") jobId: string) {
    return this.socialService.retryPublishJob(jobId);
  }
}
