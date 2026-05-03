import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  PublishSourceType,
  PublishingPlatform,
  PublishingStatus,
  QueueState
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { PrismaService } from "../prisma/prisma.service";
import { OperationsAlertService } from "../shared/operations-alert.service";
import { TokenEncryptionService } from "../shared/token-encryption.service";
import { FacebookAdapter } from "./facebook.adapter";
import { InstagramAdapter } from "./instagram.adapter";
import { PlatformAdapter } from "./platform-adapter.interface";
import { ThreadsAdapter } from "./threads.adapter";
import { YouTubeAdapter } from "./youtube.adapter";

type PublishingJobWithRelations = Prisma.PublishingJobGetPayload<{
  include: {
    contentVariant: true;
    videoOutput: true;
    logs: true;
    queueItem: true;
  };
}>;

@Injectable()
export class PublishingProcessorService {
  private readonly logger = new Logger(PublishingProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly tenancyService: TenancyService,
    private readonly operationsAlert: OperationsAlertService,
    private readonly facebookAdapter: FacebookAdapter,
    private readonly instagramAdapter: InstagramAdapter,
    private readonly threadsAdapter: ThreadsAdapter,
    private readonly youtubeAdapter: YouTubeAdapter
  ) {}

  async process(publishingJobId: string, source: "bullmq" | "cron" | "manual" = "manual") {
    const job = await this.prisma.publishingJob.findUnique({
      where: { id: publishingJobId },
      include: {
        contentVariant: true,
        videoOutput: true,
        logs: true,
        queueItem: true
      }
    });

    if (!job) {
      throw new NotFoundException("找不到發布任務");
    }

    await this.tenancyService.assertTenantAccess(job.tenantId);

    await this.prisma.publishingJob.update({
      where: { id: publishingJobId },
      data: {
        status: PublishingStatus.PROCESSING,
        attempts: { increment: 1 }
      }
    });

    await this.prisma.publishQueue.updateMany({
      where: { publishingJobId },
      data: { queueState: QueueState.PROCESSING, lastAttemptAt: new Date() }
    });

    const results: Array<{ platform: PublishingPlatform; ok: boolean; postId?: string; error?: string; status?: PublishingStatus }> = [];

    for (const platform of job.platforms) {
      try {
        const adapter = this.adapterFor(platform);
        const account = await this.ensureAccount(platform, job.tenantId ?? null);
        await adapter.connectAccount(account.id);
        await adapter.refreshToken(account.id);

        await this.validateMediaOrThrow(job, platform);
        await adapter.validateMedia({
          videoOutputId: job.videoOutputId,
          caption: job.caption,
          hashtags: job.hashtags
        });

        const publishAt = job.publishAt ?? undefined;
        const adapterResult =
          publishAt && publishAt.getTime() > Date.now()
            ? await adapter.schedulePost({
                accountId: account.id,
                videoOutputId: job.videoOutputId,
                caption: job.caption,
                hashtags: job.hashtags,
                publishAt
              })
            : await adapter.publishNow({
                accountId: account.id,
                videoOutputId: job.videoOutputId,
                caption: job.caption,
                hashtags: job.hashtags
              });

        await this.prisma.publishLog.create({
          data: {
            tenantId: job.tenantId ?? null,
            publishingJobId,
            platform,
            action: publishAt && publishAt.getTime() > Date.now() ? "schedulePost" : "publishNow",
            status: adapterResult.status,
            requestPayload: {
              source,
              caption: job.caption,
              hashtags: job.hashtags,
              videoOutputId: job.videoOutputId,
              contentVariantId: job.contentVariantId
            } as Prisma.InputJsonValue,
            responsePayload: adapterResult as unknown as Prisma.InputJsonValue
          }
        });

        results.push({ platform, ok: true, postId: adapterResult.postId, status: adapterResult.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown publish error";
        await this.prisma.publishLog.create({
          data: {
            tenantId: job.tenantId ?? null,
            publishingJobId,
            platform,
            action: "publishNow",
            status: PublishingStatus.FAILED,
            requestPayload: {
              source,
              caption: job.caption,
              hashtags: job.hashtags
            } as Prisma.InputJsonValue,
            errorMessage: message
          }
        });
        results.push({ platform, ok: false, error: message });
        this.logger.warn(`Publish failed on ${platform}: ${message}`);
        await this.operationsAlert.notifyPublishingFailure({
          tenantId: job.tenantId ?? null,
          publishingJobId,
          platform,
          errorMessage: message
        });
      }
    }

    const successCount = results.filter((item) => item.ok).length;
    const scheduledCount = results.filter((item) => item.status === PublishingStatus.SCHEDULED).length;
    const finalStatus =
      scheduledCount === results.length && results.length > 0
        ? PublishingStatus.SCHEDULED
        : successCount === results.length
        ? PublishingStatus.SUCCESS
        : successCount > 0
          ? PublishingStatus.PARTIAL_SUCCESS
          : PublishingStatus.FAILED;

    await this.prisma.publishingJob.update({
      where: { id: publishingJobId },
      data: {
        status: finalStatus,
        errorMessage: finalStatus === PublishingStatus.SUCCESS ? null : results.filter((item) => !item.ok).map((item) => item.error).join(" | ") || null,
        retryAt: finalStatus === PublishingStatus.FAILED ? new Date(Date.now() + 15 * 60 * 1000) : null
      }
    });

    await this.prisma.publishQueue.updateMany({
      where: { publishingJobId },
      data: {
        queueState: finalStatus === PublishingStatus.SUCCESS ? QueueState.DONE : finalStatus === PublishingStatus.FAILED ? QueueState.FAILED : QueueState.DONE
      }
    });

    return this.getDetail(publishingJobId);
  }

  async getDetail(publishingJobId: string) {
    const job = await this.prisma.publishingJob.findUnique({
      where: { id: publishingJobId },
      include: {
        queueItem: true,
        logs: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("找不到發布任務");
    }

    await this.tenancyService.assertTenantAccess(job.tenantId);

    return {
      id: job.id,
      sourceType: job.sourceType,
      caption: job.caption,
      hashtags: job.hashtags,
      platforms: job.platforms,
      publishAt: job.publishAt,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      contentVariantId: job.contentVariantId,
      videoOutputId: job.videoOutputId,
      queueItem: job.queueItem
        ? {
            id: job.queueItem.id,
            queueName: job.queueItem.queueName,
            queueState: job.queueItem.queueState,
            scheduledFor: job.queueItem.scheduledFor,
            bullJobId: job.queueItem.bullJobId
          }
        : null,
      logs: job.logs.map((log) => ({
        id: log.id,
        platform: log.platform,
        action: log.action,
        status: log.status,
        requestPayload: log.requestPayload as Record<string, unknown> | null,
        responsePayload: log.responsePayload as Record<string, unknown> | null,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt
      }))
    };
  }

  async listJobs(take = 20, tenantId?: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    const jobs = await this.prisma.publishingJob.findMany({
      where: tenantId ? { tenantId } : undefined,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        queueItem: true,
        logs: true
      }
    });

    return jobs.map((job) => ({
      id: job.id,
      sourceType: job.sourceType,
      caption: job.caption,
      hashtags: job.hashtags,
      platforms: job.platforms,
      publishAt: job.publishAt,
      status: job.status,
      attempts: job.attempts,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      queueState: job.queueItem?.queueState ?? null
    }));
  }

  async retryFailedJob(publishingJobId: string) {
    const job = await this.prisma.publishingJob.findUnique({
      where: { id: publishingJobId }
    });

    if (!job) {
      throw new NotFoundException("找不到發布任務");
    }

    await this.prisma.publishingJob.update({
      where: { id: publishingJobId },
      data: {
        status: PublishingStatus.RETRYING,
        errorMessage: null
      }
    });
    return this.getDetail(publishingJobId);
  }

  async refreshTokenForPlatform(platform: PublishingPlatform, accountId: string) {
    const adapter = this.adapterFor(platform);
    await adapter.refreshToken(accountId);
  }

  private adapterFor(platform: PublishingPlatform): PlatformAdapter {
    switch (platform) {
      case PublishingPlatform.FACEBOOK:
        return this.facebookAdapter;
      case PublishingPlatform.INSTAGRAM:
        return this.instagramAdapter;
      case PublishingPlatform.THREADS:
        return this.threadsAdapter;
      case PublishingPlatform.YOUTUBE:
        return this.youtubeAdapter;
      default:
        return this.facebookAdapter;
    }
  }

  private async ensureAccount(platform: PublishingPlatform, tenantId?: string | null) {
    const existing = await this.prisma.platformAccount.findFirst({
      where: {
        platform,
        isActive: true,
        tenantId: tenantId ?? undefined
      },
      include: {
        token: true
      },
      orderBy: { createdAt: "asc" }
    });

    if (!existing) {
      throw new NotFoundException(`找不到可用的 ${platform} 發布帳號，請先完成真實社群綁定`);
    }

    if (!existing.token) {
      throw new NotFoundException(`找不到 ${platform} 的有效權杖，請重新綁定社群帳號`);
    }

    const metadata =
      existing.token.metadata && typeof existing.token.metadata === "object"
        ? (existing.token.metadata as Record<string, unknown>)
        : null;
    const provider = typeof metadata?.provider === "string" ? metadata.provider.toLowerCase() : "";
    const accessToken = this.tokenEncryption.decrypt(existing.token.accessTokenEncrypted);

    if (provider === "mock" || accessToken.startsWith("mock-")) {
      throw new NotFoundException(`偵測到 ${platform} 使用的是測試權杖，正式發布已停用 mock 帳號`);
    }

    return existing;
  }

  private async validateMediaOrThrow(job: PublishingJobWithRelations, platform: PublishingPlatform) {
    if (job.sourceType === PublishSourceType.VIDEO_OUTPUT) {
      if (!job.videoOutput) {
        throw new Error("缺少影片輸出");
      }

      if (job.videoOutput.outputFormat.toLowerCase() !== "mp4") {
        throw new Error("影片格式必須為 MP4");
      }

      if (job.videoOutput.width !== 1080 || job.videoOutput.height !== 1920) {
        throw new Error("影片比例必須為 9:16 且解析度為 1080x1920");
      }
    }

    if (job.sourceType === PublishSourceType.CONTENT_VARIANT && !job.contentVariant) {
      throw new Error("缺少文案內容");
    }

    if (platform === PublishingPlatform.YOUTUBE && job.sourceType !== PublishSourceType.VIDEO_OUTPUT) {
      throw new Error("YouTube 需使用影片來源");
    }
  }
}
