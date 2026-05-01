import type { AnalyticsInsight, AnalyticsSuggestion, OptimizationContext, OptimizationRuleSnapshot } from "@ai-vidio/types";
import type { PublishingPlatform } from "@prisma/client";

export type AnalyticsTimeRange = {
  workspaceId?: string;
  brandId?: string;
  from?: string;
  to?: string;
};

export type MetricsSyncInput = {
  workspaceId?: string;
  brandId?: string;
  platform: PublishingPlatform;
  postId: string;
  platformAccountId?: string;
  publishedAt?: Date;
  metricDate?: Date;
};

export type PlatformMetricPayload = {
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  completionRate: number;
  followersGrowth: number;
  raw?: unknown;
};

export type AnalyticsKpi = {
  label: string;
  value: number;
  delta?: number;
  unit?: string;
};

export type AnalyticsDashboardSnapshot = {
  kpis: AnalyticsKpi[];
  topContents: ContentPerformanceSnapshot[];
  dailyReports: DailyReportSnapshot[];
  trendingTopics: TrendingTopicSnapshot[];
  suggestions: AnalyticsSuggestion[];
  rules: OptimizationRuleSnapshot[];
  insights: AnalyticsInsight[];
  optimizationContext: OptimizationContext;
};

export type ContentPerformanceSnapshot = {
  id: string;
  contentId?: string | null;
  videoId?: string | null;
  publishingJobId?: string | null;
  platform?: PublishingPlatform | null;
  score: number;
  titleCtr: number;
  hookRetention: number;
  completionRate: number;
  engagementRate: number;
  ctaConversionRate: number;
  bestHook?: string | null;
  bestCta?: string | null;
  bestLengthSeconds?: number | null;
  bestPublishHour?: number | null;
  bestTone?: string | null;
  bestStyle?: string | null;
  winningKeywords: string[];
  insights?: unknown;
};

export type DailyReportSnapshot = {
  id: string;
  reportDate: string;
  metricsSummary: Record<string, unknown>;
  insights: Record<string, unknown>;
};

export type TrendingTopicSnapshot = {
  id: string;
  topic: string;
  score: number;
  sourcePlatforms: string[];
  evidence?: unknown;
};
