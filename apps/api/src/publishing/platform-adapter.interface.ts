import { PublishAdapterResult } from "./publishing.types";
import { PublishingPlatform } from "@prisma/client";

export interface PlatformAdapter {
  readonly platform: PublishingPlatform;
  connectAccount(accountId: string): Promise<void>;
  refreshToken(accountId: string): Promise<void>;
  validateMedia(input: { videoOutputId?: string | null; caption: string; hashtags: string[] }): Promise<void>;
  publishNow(input: {
    accountId: string;
    videoOutputId?: string | null;
    caption: string;
    hashtags: string[];
  }): Promise<PublishAdapterResult>;
  schedulePost(input: {
    accountId: string;
    videoOutputId?: string | null;
    caption: string;
    hashtags: string[];
    publishAt: Date;
  }): Promise<PublishAdapterResult>;
  getPostStatus(postId: string): Promise<{ postId: string; status: string }>;
  fetchMetrics(postId: string): Promise<Record<string, unknown>>;
}
