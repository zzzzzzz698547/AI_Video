import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PlatformAdapter } from "./platform-adapter.interface";
import { PublishAdapterResult } from "./publishing.types";
import { PublishingPlatform, PublishingStatus } from "@prisma/client";

@Injectable()
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: PublishingPlatform;

  async connectAccount(_: string) {
    return;
  }

  async refreshToken(_: string) {
    return;
  }

  async validateMedia(_: { videoOutputId?: string | null; caption: string; hashtags: string[] }) {
    return;
  }

  async publishNow(input: {
    accountId: string;
    videoOutputId?: string | null;
    caption: string;
    hashtags: string[];
  }): Promise<PublishAdapterResult> {
    return {
      platform: this.platform,
      postId: `${this.platform.toLowerCase()}_${randomUUID()}`,
      status: PublishingStatus.SUCCESS,
      publishedAt: new Date(),
      payload: {
        mode: "publishNow",
        accountId: input.accountId,
        caption: input.caption,
        hashtags: input.hashtags
      }
    };
  }

  async schedulePost(input: {
    accountId: string;
    videoOutputId?: string | null;
    caption: string;
    hashtags: string[];
    publishAt: Date;
  }): Promise<PublishAdapterResult> {
    return {
      platform: this.platform,
      postId: `${this.platform.toLowerCase()}_${randomUUID()}`,
      status: PublishingStatus.SCHEDULED,
      publishedAt: input.publishAt,
      payload: {
        mode: "schedulePost",
        accountId: input.accountId,
        publishAt: input.publishAt.toISOString()
      }
    };
  }

  async getPostStatus(postId: string) {
    return { postId, status: "published" };
  }

  async fetchMetrics(postId: string) {
    return {
      postId,
      impressions: 0,
      clicks: 0,
      likes: 0,
      comments: 0
    };
  }
}
