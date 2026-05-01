import type { PublishingPlatform } from "@prisma/client";
import type { MetricsSyncInput, PlatformMetricPayload } from "./analytics.types";

export interface PlatformAnalyticsAdapter {
  readonly platform: PublishingPlatform;
  fetchPostMetrics(input: MetricsSyncInput): Promise<PlatformMetricPayload[]>;
}

abstract class BasePlatformAnalyticsAdapter implements PlatformAnalyticsAdapter {
  abstract readonly platform: PublishingPlatform;

  async fetchPostMetrics(): Promise<PlatformMetricPayload[]> {
    return [];
  }
}

export class FacebookAnalyticsAdapter extends BasePlatformAnalyticsAdapter {
  readonly platform = "FACEBOOK" as const;
}

export class InstagramAnalyticsAdapter extends BasePlatformAnalyticsAdapter {
  readonly platform = "INSTAGRAM" as const;
}

export class ThreadsAnalyticsAdapter extends BasePlatformAnalyticsAdapter {
  readonly platform = "THREADS" as const;
}

export class YouTubeAnalyticsAdapter extends BasePlatformAnalyticsAdapter {
  readonly platform = "YOUTUBE" as const;
}
