import { PublishSourceType, PublishingPlatform, PublishingStatus } from "@prisma/client";

export interface CreatePublishJobDtoShape {
  contentVariantId?: string | null;
  videoOutputId?: string | null;
  caption: string;
  hashtags: string[];
  platforms: PublishingPlatform[];
  publishAt?: string | null;
  sourceType: PublishSourceType;
}

export interface PublishAdapterResult {
  platform: PublishingPlatform;
  postId: string;
  status: PublishingStatus;
  publishedAt: Date;
  payload: Record<string, unknown>;
}

export interface PublishJobDetail {
  id: string;
  sourceType: PublishSourceType;
  caption: string;
  hashtags: string[];
  platforms: PublishingPlatform[];
  publishAt: Date | null;
  status: PublishingStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  contentVariantId: string | null;
  videoOutputId: string | null;
  queueItem: {
    id: string;
    queueName: string;
    queueState: string;
    scheduledFor: Date | null;
    bullJobId: string | null;
  } | null;
  logs: Array<{
    id: string;
    platform: PublishingPlatform;
    action: string;
    status: PublishingStatus;
    requestPayload: Record<string, unknown> | null;
    responsePayload: Record<string, unknown> | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}
