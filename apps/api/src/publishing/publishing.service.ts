import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PublishSourceType, PublishingStatus, QueueState } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePublishJobDto } from "./publishing.dto";
import { PublishingQueueService } from "./publishing.queue.service";
import { PublishingProcessorService } from "./publishing.processor.service";

@Injectable()
export class PublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyService: TenancyService,
    private readonly queue: PublishingQueueService,
    private readonly processor: PublishingProcessorService
  ) {}

  async createPublishJob(dto: CreatePublishJobDto) {
    if (dto.sourceType === PublishSourceType.VIDEO_OUTPUT && !dto.videoOutputId) {
      throw new BadRequestException("選擇影片來源時，videoOutputId 為必填");
    }

    if (dto.sourceType === PublishSourceType.CONTENT_VARIANT && !dto.contentVariantId) {
      throw new BadRequestException("選擇文案來源時，contentVariantId 為必填");
    }

    const tenantId = await this.resolveTenantId(dto);
    await this.tenancyService.assertTenantAccess(tenantId);

    const publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    const status = publishAt && publishAt.getTime() > Date.now() ? PublishingStatus.SCHEDULED : PublishingStatus.QUEUED;
    const job = await this.prisma.publishingJob.create({
      data: {
        tenantId,
        sourceType: dto.sourceType,
        contentVariantId: dto.contentVariantId ?? null,
        videoOutputId: dto.videoOutputId ?? null,
        caption: dto.caption.trim(),
        hashtags: dto.hashtags,
        platforms: dto.platforms,
        publishAt,
        status,
        attempts: 0,
        maxAttempts: 5
      }
    });

    await this.prisma.publishQueue.create({
      data: {
        tenantId,
        publishingJobId: job.id,
        queueName: "publishing",
        queueState: publishAt && publishAt.getTime() > Date.now() ? QueueState.PENDING : QueueState.ENQUEUED,
        scheduledFor: publishAt
      }
    });

    if (!publishAt || publishAt.getTime() <= Date.now()) {
      await this.queue.enqueue(job.id, 0);
    } else if (this.queue.isReady()) {
      await this.queue.enqueue(job.id, publishAt.getTime() - Date.now());
    }

    return this.processor.getDetail(job.id);
  }

  private async resolveTenantId(dto: CreatePublishJobDto) {
    if (dto.tenantId) {
      return dto.tenantId;
    }

    if (dto.videoOutputId) {
      const output = await this.prisma.videoOutput.findUnique({
        where: { id: dto.videoOutputId },
        select: { tenantId: true }
      });
      if (output?.tenantId) {
        return output.tenantId;
      }
    }

    if (dto.contentVariantId) {
      const variant = await this.prisma.contentVariant.findUnique({
        where: { id: dto.contentVariantId },
        include: {
          generatedContent: {
            select: { tenantId: true }
          }
        }
      });
      if (variant?.generatedContent.tenantId) {
        return variant.generatedContent.tenantId;
      }
    }

    return null;
  }

  async getPublishJob(id: string) {
    return this.processor.getDetail(id);
  }

  async listPublishes(take = 20, tenantId?: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    return this.processor.listJobs(take, tenantId);
  }

  async retryJob(id: string) {
    const job = await this.prisma.publishingJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException("找不到發布任務");
    }

    await this.tenancyService.assertTenantAccess(job.tenantId);

    await this.processor.retryFailedJob(id);

    await this.queue.enqueue(id, 0);

    return this.processor.getDetail(id);
  }

  async sweepScheduledJobs() {
    const pendingJobs = await this.prisma.publishingJob.findMany({
      where: {
        status: PublishingStatus.SCHEDULED,
        publishAt: {
          lte: new Date()
        }
      },
      take: 25,
      orderBy: { publishAt: "asc" }
    });

    for (const job of pendingJobs) {
      await this.queue.enqueue(job.id, 0);
    }

    return pendingJobs.length;
  }

  async refreshTokensSoon() {
    const expiringTokens = await this.prisma.platformToken.findMany({
      where: {
        expiresAt: {
          lte: new Date(Date.now() + 15 * 60 * 1000)
        }
      },
      include: {
        account: true
      }
    });

    for (const token of expiringTokens) {
      const refreshedAt = new Date();
      await this.processor.refreshTokenForPlatform(token.account.platform, token.account.id);
      await this.prisma.platformToken.update({
        where: { id: token.id },
        data: {
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          metadata: {
            refreshedAt: refreshedAt.toISOString()
          } as Prisma.InputJsonValue
        }
      });
    }

    return expiringTokens.length;
  }
}
