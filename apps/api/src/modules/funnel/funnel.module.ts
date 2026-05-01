import { Module } from "@nestjs/common";
import { FunnelController } from "./funnel.controller";
import { FunnelService } from "./funnel.service";
import { TrackingLinkService } from "./tracking-link.service";
import { LandingPageService } from "./landing-page.service";
import { LeadService } from "./lead.service";
import { FollowUpService } from "./follow-up.service";
import { ConversionAnalyticsService } from "./conversion-analytics.service";
import { LeadOptimizerService } from "./lead-optimizer.service";

@Module({
  controllers: [FunnelController],
  providers: [
    FunnelService,
    TrackingLinkService,
    LandingPageService,
    LeadService,
    FollowUpService,
    ConversionAnalyticsService,
    LeadOptimizerService
  ],
  exports: [FunnelService, TrackingLinkService, LandingPageService, LeadService, FollowUpService]
})
export class FunnelModule {}
