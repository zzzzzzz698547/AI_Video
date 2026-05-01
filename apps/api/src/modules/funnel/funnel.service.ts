import { Injectable } from "@nestjs/common";
import { TrackingLinkService } from "./tracking-link.service";
import { LandingPageService } from "./landing-page.service";
import { LeadService } from "./lead.service";
import { FollowUpService } from "./follow-up.service";
import { ConversionAnalyticsService } from "./conversion-analytics.service";
import { LeadOptimizerService } from "./lead-optimizer.service";
import type { ClickTrackingInput, LeadFormInput, LeadFollowUpTemplateInput, TrackingLinkInput } from "./funnel.types";

@Injectable()
export class FunnelService {
  constructor(
    private readonly trackingLinkService: TrackingLinkService,
    private readonly landingPageService: LandingPageService,
    private readonly leadService: LeadService,
    private readonly followUpService: FollowUpService,
    private readonly conversionAnalyticsService: ConversionAnalyticsService,
    private readonly leadOptimizerService: LeadOptimizerService
  ) {}

  createTrackingLink(input: TrackingLinkInput) {
    return this.trackingLinkService.createTrackingLink(input);
  }

  resolveTrackingLink(code: string, click?: ClickTrackingInput) {
    if (click) {
      return this.trackingLinkService.recordClick(code, click);
    }

    return this.trackingLinkService.resolveTrackingLink(code);
  }

  trackClick(code: string, input: ClickTrackingInput) {
    return this.trackingLinkService.recordClick(code, input);
  }

  getLandingPage(slug: string, variantKey?: string) {
    return this.landingPageService.getLandingPage(slug, variantKey);
  }

  getLandingPages(workspaceId?: string) {
    return this.landingPageService.listLandingPages(workspaceId);
  }

  upsertLandingPage(input: Parameters<LandingPageService["upsertLandingPage"]>[0]) {
    return this.landingPageService.upsertLandingPage(input);
  }

  submitLead(input: LeadFormInput) {
    return this.leadService.submitLead(input);
  }

  listLeads(workspaceId?: string, take?: number) {
    return this.leadService.listLeads(workspaceId, take);
  }

  getLead(id: string) {
    return this.leadService.findLead(id);
  }

  updateLeadStatus(id: string, input: Parameters<LeadService["updateLeadStatus"]>[1]) {
    return this.leadService.updateLeadStatus(id, input);
  }

  triggerFollowUp(leadId: string) {
    return this.followUpService.triggerLeadFollowUp(leadId);
  }

  listTemplates(workspaceId?: string) {
    return this.followUpService.listTemplates(workspaceId);
  }

  upsertFollowUpTemplate(input: LeadFollowUpTemplateInput) {
    return this.followUpService.upsertTemplate(input);
  }

  dashboard(workspaceId?: string) {
    return this.conversionAnalyticsService.dashboard(workspaceId);
  }

  sourceAnalytics(workspaceId?: string) {
    return this.conversionAnalyticsService.contentAnalytics(workspaceId);
  }

  optimizer(workspaceId?: string) {
    return this.leadOptimizerService.suggestOptimizations(workspaceId);
  }
}
