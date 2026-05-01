import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsCronService } from "./analytics.cron.service";
import { AnalyticsEngineService } from "./analytics-engine.service";
import { AnalyticsService } from "./analytics.service";
import { AbTestService } from "./ab-test.service";
import { MetricsService } from "./metrics.service";
import {
  FacebookAnalyticsAdapter,
  InstagramAnalyticsAdapter,
  ThreadsAnalyticsAdapter,
  YouTubeAnalyticsAdapter
} from "./platform-analytics.adapter";
import { OptimizationEngineService } from "./optimization-engine.service";

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsEngineService,
    AnalyticsCronService,
    MetricsService,
    OptimizationEngineService,
    AbTestService,
    FacebookAnalyticsAdapter,
    InstagramAnalyticsAdapter,
    ThreadsAnalyticsAdapter,
    YouTubeAnalyticsAdapter
  ],
  exports: [AnalyticsService, AnalyticsEngineService, OptimizationEngineService]
})
export class AnalyticsModule {}
