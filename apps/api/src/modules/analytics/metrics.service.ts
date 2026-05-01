import { Injectable } from "@nestjs/common";
import type { PlatformMetric, PublishingPlatform } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  FacebookAnalyticsAdapter,
  InstagramAnalyticsAdapter,
  ThreadsAnalyticsAdapter,
  YouTubeAnalyticsAdapter
} from "./platform-analytics.adapter";
import type { MetricsSyncInput, PlatformMetricPayload } from "./analytics.types";

@Injectable()
export class MetricsService {
  private readonly adapters: Record<PublishingPlatform, { fetchPostMetrics: (input: MetricsSyncInput) => Promise<PlatformMetricPayload[]> }>;

  constructor(
    private readonly prisma: PrismaService,
    facebookAdapter: FacebookAnalyticsAdapter,
    instagramAdapter: InstagramAnalyticsAdapter,
    threadsAdapter: ThreadsAnalyticsAdapter,
    youTubeAdapter: YouTubeAnalyticsAdapter
  ) {
    this.adapters = {
      FACEBOOK: facebookAdapter,
      INSTAGRAM: instagramAdapter,
      THREADS: threadsAdapter,
      YOUTUBE: youTubeAdapter
    };
  }

  async syncPostMetrics(input: MetricsSyncInput) {
    const adapter = this.adapters[input.platform];
    const payloads = await adapter.fetchPostMetrics(input);
    if (payloads.length === 0) {
      return [];
    }

    const metricDate = input.metricDate ?? input.publishedAt ?? new Date();
    return this.prisma.platformMetric.createMany({
      data: payloads.map((payload) => ({
        workspaceId: input.workspaceId ?? null,
        brandId: input.brandId ?? null,
        platform: input.platform,
        platformAccountId: input.platformAccountId ?? null,
        publishingJobId: input.postId,
        externalPostId: input.postId,
        publishedAt: input.publishedAt ?? null,
        metricDate,
        impressions: payload.impressions,
        views: payload.views,
        clicks: payload.clicks,
        likes: payload.likes,
        comments: payload.comments,
        shares: payload.shares,
        saves: payload.saves,
        completionRate: payload.completionRate,
        followersGrowth: payload.followersGrowth,
        source: "platform-api",
        raw: payload.raw as never
      }))
    });
  }

  async recordPlatformMetrics(records: Array<MetricsSyncInput & PlatformMetricPayload>) {
    if (records.length === 0) {
      return { count: 0 };
    }

    const result = await this.prisma.platformMetric.createMany({
      data: records.map((record) => ({
        workspaceId: record.workspaceId ?? null,
        brandId: record.brandId ?? null,
        platform: record.platform,
        platformAccountId: record.platformAccountId ?? null,
        publishingJobId: record.postId,
        externalPostId: record.postId,
        publishedAt: record.publishedAt ?? null,
        metricDate: record.metricDate ?? record.publishedAt ?? new Date(),
        impressions: record.impressions,
        views: record.views,
        clicks: record.clicks,
        likes: record.likes,
        comments: record.comments,
        shares: record.shares,
        saves: record.saves,
        completionRate: record.completionRate,
        followersGrowth: record.followersGrowth,
        source: "platform-api",
        raw: record.raw as never
      }))
    });

    return { count: result.count };
  }

  async listRecentMetrics(workspaceId?: string, brandId?: string, take = 100): Promise<PlatformMetric[]> {
    return this.prisma.platformMetric.findMany({
      where: {
        workspaceId: workspaceId ?? undefined,
        brandId: brandId ?? undefined
      },
      orderBy: { metricDate: "desc" },
      take
    });
  }
}
