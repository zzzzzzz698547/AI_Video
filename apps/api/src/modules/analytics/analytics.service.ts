import { Injectable } from "@nestjs/common";
import { AnalyticsEngineService } from "./analytics-engine.service";
import { MetricsService } from "./metrics.service";
import { OptimizationEngineService } from "./optimization-engine.service";
import { AbTestService, type CreateAbTestInput, type RecordAbTestResultInput } from "./ab-test.service";
import type { AnalyticsTimeRange, MetricsSyncInput, PlatformMetricPayload } from "./analytics.types";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly analyticsEngine: AnalyticsEngineService,
    private readonly optimizationEngine: OptimizationEngineService,
    private readonly abTestService: AbTestService
  ) {}

  dashboard(range: AnalyticsTimeRange = {}) {
    return this.analyticsEngine.buildDashboard(range);
  }

  content(contentId: string) {
    return this.analyticsEngine.analyzeContent(contentId);
  }

  top(range: AnalyticsTimeRange = {}) {
    return this.analyticsEngine.topContent(range);
  }

  trends(range: AnalyticsTimeRange = {}) {
    return this.analyticsEngine.trends(range);
  }

  suggestions(range: AnalyticsTimeRange = {}) {
    return this.analyticsEngine.suggestions(range);
  }

  refreshDailyReport(range: AnalyticsTimeRange = {}) {
    return this.analyticsEngine.refreshDailyReport(range);
  }

  syncMetrics(input: MetricsSyncInput) {
    return this.metricsService.syncPostMetrics(input);
  }

  recordMetrics(records: Array<MetricsSyncInput & PlatformMetricPayload>) {
    return this.metricsService.recordPlatformMetrics(records);
  }

  deriveRules(range: AnalyticsTimeRange = {}) {
    return this.optimizationEngine.deriveRules(range);
  }

  optimizationContext(range: AnalyticsTimeRange = {}) {
    return this.optimizationEngine.buildOptimizationContext(range);
  }

  refreshOptimizationRules(range: AnalyticsTimeRange = {}) {
    return this.optimizationEngine.refreshOptimizationRules(range);
  }

  createAbTest(input: CreateAbTestInput) {
    return this.abTestService.createTest(input);
  }

  listAbTests(range: AnalyticsTimeRange = {}) {
    return this.abTestService.listTests(range);
  }

  recordAbTestResult(input: RecordAbTestResultInput) {
    return this.abTestService.recordResult(input);
  }
}
