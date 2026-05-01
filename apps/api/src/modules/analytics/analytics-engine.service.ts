import { Injectable } from "@nestjs/common";
import type { ContentPerformance, DailyReport, OptimizationRule, PlatformMetric, TrendingTopic } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { DomainModuleName, AnalyticsInsight, AnalyticsSuggestion, OptimizationContext } from "@ai-vidio/types";
import type {
  AnalyticsDashboardSnapshot,
  AnalyticsTimeRange,
  ContentPerformanceSnapshot,
  DailyReportSnapshot,
  TrendingTopicSnapshot
} from "./analytics.types";

type MetricTotals = {
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followersGrowth: number;
  completionRate: number;
};

@Injectable()
export class AnalyticsEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async buildDashboard(range: AnalyticsTimeRange = {}): Promise<AnalyticsDashboardSnapshot> {
    const [metrics, contentPerformance, dailyReports, trendingTopics, rules] = await Promise.all([
      this.fetchPlatformMetrics(range),
      this.fetchContentPerformance(range),
      this.fetchDailyReports(range),
      this.fetchTrendingTopics(range),
      this.fetchActiveRules(range)
    ]);

    const totals = this.calculateTotals(metrics);
    const kpis = [
      { label: "總曝光", value: totals.impressions, unit: "impressions" },
      { label: "總觀看", value: totals.views, unit: "views" },
      { label: "總點擊", value: totals.clicks, unit: "clicks" },
      { label: "總互動", value: totals.likes + totals.comments + totals.shares + totals.saves, unit: "engagements" },
      { label: "平均完播率", value: Math.round(totals.completionRate), unit: "%" }
    ];

    const topContents = contentPerformance.slice(0, 10).map((item) => this.toContentPerformanceSnapshot(item));
    const suggestions = this.buildSuggestions(contentPerformance, trendingTopics, rules);
    const optimizationContext = this.buildOptimizationContext(contentPerformance, rules);
    const insights = this.buildInsights(totals, contentPerformance, trendingTopics);

    return {
      kpis,
      topContents,
      dailyReports: dailyReports.map((item) => this.toDailyReportSnapshot(item)),
      trendingTopics: trendingTopics.map((item) => this.toTrendingTopicSnapshot(item)),
      suggestions,
      rules: rules.map((rule) => this.toOptimizationRuleSnapshot(rule)),
      insights,
      optimizationContext
    };
  }

  async analyzeContent(contentId: string) {
    const [performance, metrics] = await Promise.all([
      this.prisma.contentPerformance.findFirst({ where: { contentId } }),
      this.prisma.platformMetric.findMany({ where: { contentId }, orderBy: { metricDate: "desc" } })
    ]);

    return {
      contentId,
      performance: performance ? this.toContentPerformanceSnapshot(performance) : null,
      metrics: metrics.map((item) => this.toMetricCard(item)),
      insights: this.buildContentInsights(performance, metrics)
    };
  }

  async topContent(range: AnalyticsTimeRange = {}) {
    const rows = await this.fetchContentPerformance(range);
    return rows.slice(0, 20).map((item) => this.toContentPerformanceSnapshot(item));
  }

  async trends(range: AnalyticsTimeRange = {}) {
    const rows = await this.fetchTrendingTopics(range);
    return rows.map((item) => this.toTrendingTopicSnapshot(item));
  }

  async suggestions(range: AnalyticsTimeRange = {}) {
    const [contentPerformance, trendingTopics, rules] = await Promise.all([
      this.fetchContentPerformance(range),
      this.fetchTrendingTopics(range),
      this.fetchActiveRules(range)
    ]);

    return {
      suggestions: this.buildSuggestions(contentPerformance, trendingTopics, rules),
      optimizationContext: this.buildOptimizationContext(contentPerformance, rules)
    };
  }

  async refreshDailyReport(range: AnalyticsTimeRange = {}) {
    const metrics = await this.fetchPlatformMetrics(range);
    const totals = this.calculateTotals(metrics);
    const reportDate = this.resolveReportDate(range);

    const existing = await this.prisma.dailyReport.findFirst({
      where: {
        ...this.rangeWhere(range),
        reportDate
      }
    });

    if (existing) {
      return this.prisma.dailyReport.update({
        where: { id: existing.id },
        data: {
          metricsSummary: totals as never,
          insights: this.buildInsights(totals, [], [])
        }
      });
    }

    return this.prisma.dailyReport.create({
      data: {
        workspaceId: range.workspaceId ?? null,
        brandId: range.brandId ?? null,
        reportDate,
        metricsSummary: totals as never,
        insights: this.buildInsights(totals, [], [])
      }
    });
  }

  private async fetchPlatformMetrics(range: AnalyticsTimeRange): Promise<PlatformMetric[]> {
    return this.prisma.platformMetric.findMany({
      where: this.rangeWhere(range),
      orderBy: { metricDate: "desc" }
    });
  }

  private async fetchContentPerformance(range: AnalyticsTimeRange): Promise<ContentPerformance[]> {
    return this.prisma.contentPerformance.findMany({
      where: this.rangeWhere(range),
      orderBy: { score: "desc" }
    });
  }

  private async fetchDailyReports(range: AnalyticsTimeRange): Promise<DailyReport[]> {
    return this.prisma.dailyReport.findMany({
      where: this.rangeWhere(range),
      orderBy: { reportDate: "desc" },
      take: 30
    });
  }

  private async fetchTrendingTopics(range: AnalyticsTimeRange): Promise<TrendingTopic[]> {
    return this.prisma.trendingTopic.findMany({
      where: this.rangeWhere(range),
      orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
      take: 20
    });
  }

  private async fetchActiveRules(range: AnalyticsTimeRange): Promise<OptimizationRule[]> {
    return this.prisma.optimizationRule.findMany({
      where: {
        ...this.rangeWhere(range),
        active: true
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 20
    });
  }

  private rangeWhere(range: AnalyticsTimeRange) {
    return {
      workspaceId: range.workspaceId ?? undefined,
      brandId: range.brandId ?? undefined
    };
  }

  private calculateTotals(metrics: PlatformMetric[]): MetricTotals {
    const seed: MetricTotals = {
      impressions: 0,
      views: 0,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      followersGrowth: 0,
      completionRate: 0
    };

    if (metrics.length === 0) {
      return seed;
    }

    const sums = metrics.reduce((acc, metric) => {
      acc.impressions += metric.impressions;
      acc.views += metric.views;
      acc.clicks += metric.clicks;
      acc.likes += metric.likes;
      acc.comments += metric.comments;
      acc.shares += metric.shares;
      acc.saves += metric.saves;
      acc.followersGrowth += metric.followersGrowth;
      acc.completionRate += metric.completionRate;
      return acc;
    }, seed);

    return {
      ...sums,
      completionRate: sums.completionRate / metrics.length
    };
  }

  private buildSuggestions(
    contentPerformance: ContentPerformance[],
    trendingTopics: TrendingTopic[],
    rules: OptimizationRule[]
  ): AnalyticsSuggestion[] {
    const topContent = contentPerformance[0];
    const trendTopic = trendingTopics[0];
    const activeRule = rules[0];

    const suggestions: AnalyticsSuggestion[] = [];

    if (topContent?.bestHook) {
      suggestions.push({
        title: "沿用高表現 Hook",
        reason: `目前最強內容的 Hook 是「${topContent.bestHook}」`,
        action: "下一支內容優先測試相同開頭結構",
        target: "content",
        confidence: 0.82
      });
    }

    if (topContent?.bestCta) {
      suggestions.push({
        title: "複製高轉換 CTA",
        reason: `最佳內容的 CTA 已經驗證有效：${topContent.bestCta}`,
        action: "在下一支影片與貼文套用相同 CTA 結構",
        target: "video",
        confidence: 0.8
      });
    }

    if (trendTopic) {
      suggestions.push({
        title: "優先佈局趨勢主題",
        reason: `趨勢主題「${trendTopic.topic}」正在升溫`,
        action: "把該主題放入下一輪內容選題",
        target: "content",
        confidence: 0.75
      });
    }

    if (activeRule) {
      suggestions.push({
        title: "套用現有優化規則",
        reason: activeRule.description,
        action: activeRule.ruleKey,
        target: this.normalizeTargetModule(activeRule.targetModule),
        confidence: Math.min(0.95, activeRule.confidence || 0.7)
      });
    }

    return suggestions;
  }

  private buildOptimizationContext(contentPerformance: ContentPerformance[], rules: OptimizationRule[]): OptimizationContext {
    const bestHookPatterns = this.uniqueStrings(contentPerformance.map((item) => item.bestHook).filter(Boolean) as string[]);
    const bestCtaPatterns = this.uniqueStrings(contentPerformance.map((item) => item.bestCta).filter(Boolean) as string[]);
    const bestPublishWindows = this.uniqueStrings(
      contentPerformance
        .map((item) => item.bestPublishHour)
        .filter((hour): hour is number => typeof hour === "number")
        .map((hour) => `${hour.toString().padStart(2, "0")}:00`)
    );
    const winningKeywords = this.uniqueStrings(contentPerformance.flatMap((item) => item.winningKeywords));

    return {
      bestHookPatterns,
      bestCtaPatterns,
      bestPublishWindows,
      preferredTone: this.mostCommonString(contentPerformance.map((item) => item.bestTone).filter(Boolean) as string[]),
      preferredStyle: this.mostCommonString(contentPerformance.map((item) => item.bestStyle).filter(Boolean) as string[]),
      preferredLengthSeconds: this.averageLength(contentPerformance),
      winningKeywords,
      rules: rules.map((rule) => this.toOptimizationRuleSnapshot(rule))
    };
  }

  private buildInsights(
    totals: MetricTotals,
    contentPerformance: ContentPerformance[],
    trendingTopics: TrendingTopic[]
  ): AnalyticsInsight[] {
    const topContent = contentPerformance[0];
    const insights: AnalyticsInsight[] = [
      { label: "CTR", value: totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%` : "0%" },
      { label: "平均完播率", value: `${totals.completionRate.toFixed(2)}%` },
      { label: "互動量", value: totals.likes + totals.comments + totals.shares + totals.saves }
    ];

    if (topContent?.bestHook) {
      insights.push({ label: "最佳 Hook", value: topContent.bestHook, confidence: 0.9 });
    }

    if (trendingTopics[0]) {
      insights.push({ label: "熱門趨勢", value: trendingTopics[0].topic, confidence: 0.75 });
    }

    return insights;
  }

  private buildContentInsights(performance: ContentPerformance | null, metrics: PlatformMetric[]) {
    const totals = this.calculateTotals(metrics);
    return {
      score: performance?.score ?? 0,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      completionRate: totals.completionRate,
      engagementRate: performance?.engagementRate ?? 0,
      bestHook: performance?.bestHook ?? null,
      bestCta: performance?.bestCta ?? null,
      bestLengthSeconds: performance?.bestLengthSeconds ?? null,
      bestPublishHour: performance?.bestPublishHour ?? null,
      winningKeywords: performance?.winningKeywords ?? []
    };
  }

  private toMetricCard(metric: PlatformMetric) {
    return {
      id: metric.id,
      platform: metric.platform,
      metricDate: metric.metricDate,
      impressions: metric.impressions,
      views: metric.views,
      clicks: metric.clicks,
      likes: metric.likes,
      comments: metric.comments,
      shares: metric.shares,
      saves: metric.saves,
      completionRate: metric.completionRate,
      followersGrowth: metric.followersGrowth
    };
  }

  private toContentPerformanceSnapshot(item: ContentPerformance): ContentPerformanceSnapshot {
    return {
      id: item.id,
      contentId: item.contentId,
      videoId: item.videoId,
      publishingJobId: item.publishingJobId,
      platform: item.platform,
      score: item.score,
      titleCtr: item.titleCtr,
      hookRetention: item.hookRetention,
      completionRate: item.completionRate,
      engagementRate: item.engagementRate,
      ctaConversionRate: item.ctaConversionRate,
      bestHook: item.bestHook,
      bestCta: item.bestCta,
      bestLengthSeconds: item.bestLengthSeconds,
      bestPublishHour: item.bestPublishHour,
      bestTone: item.bestTone,
      bestStyle: item.bestStyle,
      winningKeywords: item.winningKeywords,
      insights: item.insights
    };
  }

  private toDailyReportSnapshot(item: DailyReport): DailyReportSnapshot {
    return {
      id: item.id,
      reportDate: item.reportDate.toISOString(),
      metricsSummary: item.metricsSummary as Record<string, unknown>,
      insights: item.insights as Record<string, unknown>
    };
  }

  private toTrendingTopicSnapshot(item: TrendingTopic): TrendingTopicSnapshot {
    return {
      id: item.id,
      topic: item.topic,
      score: item.score,
      sourcePlatforms: item.sourcePlatforms,
      evidence: item.evidence
    };
  }

  private toOptimizationRuleSnapshot(rule: OptimizationRule) {
    const targetModule = this.normalizeTargetModule(rule.targetModule);
    return {
      id: rule.id,
      ruleKey: rule.ruleKey,
      targetModule,
      ruleType: rule.ruleType,
      description: rule.description,
      score: rule.score,
      active: rule.active
    };
  }

  private normalizeTargetModule(value: OptimizationRule["targetModule"]): DomainModuleName {
    switch (value) {
      case "CONTENT":
        return "content";
      case "VIDEO":
        return "video";
      case "CRM":
        return "crm";
      default:
        return "content";
    }
  }

  private uniqueStrings(values: string[]) {
    return Array.from(new Set(values)).filter(Boolean);
  }

  private mostCommonString(values: string[]) {
    if (values.length === 0) {
      return undefined;
    }

    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  private averageLength(contentPerformance: ContentPerformance[]) {
    const lengths = contentPerformance.map((item) => item.bestLengthSeconds).filter((value): value is number => typeof value === "number");
    if (lengths.length === 0) {
      return undefined;
    }

    return Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length);
  }

  private resolveReportDate(range: AnalyticsTimeRange) {
    if (range.from) {
      return new Date(range.from);
    }

    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
