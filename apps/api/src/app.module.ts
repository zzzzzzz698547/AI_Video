import { Module } from "@nestjs/common";
import { ContentModule } from "./content/content.module";
import { CoreModule } from "./core/core.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ChatModule } from "./modules/chat/chat.module";
import { CrmModule } from "./modules/crm/crm.module";
import { FunnelModule } from "./modules/funnel/funnel.module";
import { UrlAnalysisModule } from "./modules/url-analysis/url-analysis.module";
import { PublishingModule } from "./publishing/publishing.module";
import { SocialModule } from "./social/social.module";
import { VideoModule } from "./video/video.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    PrismaModule,
    CoreModule,
    ContentModule,
    VideoModule,
    SocialModule,
    PublishingModule,
    AnalyticsModule,
    FunnelModule,
    CrmModule,
    ChatModule,
    UrlAnalysisModule
  ],
  controllers: [AppController]
})
export class AppModule {}
