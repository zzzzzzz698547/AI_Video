import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { ok } from "../../core/http/api-response";
import { FunnelService } from "./funnel.service";
import type { ClickTrackingInput, LeadFormInput, LeadStatusUpdateInput, LeadFollowUpTemplateInput, TrackingLinkInput } from "./funnel.types";

@Controller()
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @Get("go/:code")
  async go(
    @Param("code") code: string,
    @Query("platform") platform?: string,
    @Req() req?: any,
    @Res({ passthrough: true }) res?: any
  ) {
    const link = await this.funnelService.resolveTrackingLink(code);
    if (!link) {
      return ok({ redirectUrl: null, link: null });
    }

    await this.funnelService.trackClick(code, {
      code,
      sourcePlatform: (platform as ClickTrackingInput["sourcePlatform"]) ?? link.sourcePlatform,
      device: req?.headers["user-agent"] ? "browser" : undefined,
      ipAddress: this.extractIp(req),
      userAgent: req?.headers["user-agent"],
      referrer: req?.headers.referer ?? req?.headers.referrer,
      metadata: { requestPath: req?.url }
    });

    if (res) {
      res.redirect(302, link.destinationUrl);
      return;
    }

    return ok({ redirectUrl: link.destinationUrl, link });
  }

  @Get("landing/:slug")
  async landing(@Param("slug") slug: string, @Query("variant") variantKey?: string) {
    const page = await this.funnelService.getLandingPage(slug, variantKey);
    return ok(page);
  }

  @Get("landing-pages")
  async landingPages(@Query("workspaceId") workspaceId?: string) {
    return ok(await this.funnelService.getLandingPages(workspaceId));
  }

  @Post("lead")
  async lead(@Body() body: LeadFormInput) {
    const lead = await this.funnelService.submitLead(body);
    await this.funnelService.triggerFollowUp(lead.id);
    return ok(lead);
  }

  @Get("leads")
  async leads(@Query("workspaceId") workspaceId?: string, @Query("take") take?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return ok(await this.funnelService.listLeads(workspaceId, limit));
  }

  @Get("leads/:id")
  async getLead(@Param("id") id: string) {
    return ok(await this.funnelService.getLead(id));
  }

  @Patch("lead/:id/status")
  async updateLeadStatus(@Param("id") id: string, @Body() body: LeadStatusUpdateInput) {
    return ok(await this.funnelService.updateLeadStatus(id, body));
  }

  @Get("conversion/analytics")
  async conversionAnalytics(@Query("workspaceId") workspaceId?: string) {
    return ok(await this.funnelService.dashboard(workspaceId));
  }

  @Get("conversion/suggestions")
  async suggestions(@Query("workspaceId") workspaceId?: string) {
    return ok(await this.funnelService.optimizer(workspaceId));
  }

  @Get("templates")
  async templates(@Query("workspaceId") workspaceId?: string) {
    return ok(await this.funnelService.listTemplates(workspaceId));
  }

  @Post("landing-pages")
  async upsertLandingPage(@Body() body: Parameters<FunnelService["upsertLandingPage"]>[0]) {
    return ok(await this.funnelService.upsertLandingPage(body));
  }

  @Post("templates")
  async upsertTemplate(@Body() body: LeadFollowUpTemplateInput) {
    return ok(await this.funnelService.upsertFollowUpTemplate(body));
  }

  @Post("tracking-links")
  async createTrackingLink(@Body() body: TrackingLinkInput) {
    return ok(await this.funnelService.createTrackingLink(body));
  }

  private extractIp(req?: any) {
    const forwarded = req?.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0]?.trim();
    }

    return req?.ip ?? undefined;
  }
}
