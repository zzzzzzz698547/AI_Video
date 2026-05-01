import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  Prisma,
  SocialAdapter,
  SocialAdapterStatus,
  SocialPlatform,
  SocialPublishJob,
  SocialPublishJobStatus,
  VideoStatus
} from "@prisma/client";
import { CurrentTenantPayload } from "../core/tenancy/current-tenant.decorator";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenEncryptionService } from "../shared/token-encryption.service";
import { CreateSocialPublishJobDto } from "./dto/create-social-publish-job.dto";

type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string } | null;
};

type PublishResult = {
  externalPostId: string;
  permalink: string | null;
};

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyService: TenancyService,
    private readonly tokenEncryption: TokenEncryptionService
  ) {}

  async listAdapters(tenantId: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    const adapters = await this.prisma.socialAdapter.findMany({
      where: { tenantId },
      orderBy: [{ platform: "asc" }, { displayName: "asc" }]
    });

    return adapters.map((adapter) => this.toAdapterSummary(adapter));
  }

  async deleteAdapter(id: string) {
    const adapter = await this.prisma.socialAdapter.findUnique({ where: { id } });
    if (!adapter) {
      throw new NotFoundException("找不到社群綁定");
    }

    await this.tenancyService.assertTenantAccess(adapter.tenantId);

    await this.prisma.socialAdapter.delete({ where: { id } });
    return { id, deleted: true };
  }

  async createPublishJob(videoId: string, dto: CreateSocialPublishJobDto, currentTenant?: CurrentTenantPayload | null) {
    const video = await this.prisma.videoProject.findUnique({
      where: { id: videoId },
      include: {
        output: true,
        content: {
          include: {
            request: true
          }
        }
      }
    });

    if (!video) {
      throw new NotFoundException("找不到影片專案");
    }

    const tenantId = dto.tenantId ?? currentTenant?.tenantId ?? video.tenantId ?? video.content.tenantId ?? video.content.request.tenantId ?? null;
    await this.tenancyService.assertTenantAccess(tenantId);

    if (video.status !== VideoStatus.READY || video.output?.status !== VideoStatus.READY) {
      throw new BadRequestException("影片尚未 READY，無法發布到社群");
    }

    const adapter = await this.prisma.socialAdapter.findUnique({ where: { id: dto.adapterId } });
    if (!adapter || adapter.tenantId !== tenantId) {
      throw new BadRequestException("找不到對應的社群綁定");
    }

    if (adapter.platform !== dto.platform) {
      throw new BadRequestException("綁定平台與發布平台不一致");
    }

    if (adapter.status !== SocialAdapterStatus.ACTIVE) {
      throw new BadRequestException("此社群綁定目前不可用");
    }

    const mediaUrl = this.resolveMediaUrl(dto.mediaUrl ?? video.output?.publicUrl ?? null);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const initialStatus =
      scheduledAt && scheduledAt.getTime() > Date.now() ? SocialPublishJobStatus.QUEUED : SocialPublishJobStatus.PUBLISHING;

    const job = await this.prisma.socialPublishJob.create({
      data: {
        tenantId,
        videoId: video.id,
        platform: dto.platform,
        adapterId: dto.adapterId,
        caption: dto.caption.trim(),
        mediaUrl,
        scheduledAt,
        status: initialStatus
      }
    });

    if (initialStatus === SocialPublishJobStatus.QUEUED) {
      return this.getPublishJobDetail(job.id);
    }

    return this.publishJobNow(job.id);
  }

  async listVideoJobs(videoId: string, tenantId?: string | null, currentTenant?: CurrentTenantPayload | null) {
    const project = await this.prisma.videoProject.findUnique({
      where: { id: videoId },
      select: {
        tenantId: true,
        content: {
          select: {
            tenantId: true,
            request: {
              select: { tenantId: true }
            }
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("找不到影片專案");
    }

    const resolvedTenantId = tenantId ?? currentTenant?.tenantId ?? project.tenantId ?? project.content.tenantId ?? project.content.request.tenantId ?? null;
    await this.tenancyService.assertTenantAccess(resolvedTenantId);

    const jobs = await this.prisma.socialPublishJob.findMany({
      where: {
        tenantId: resolvedTenantId ?? undefined,
        videoId
      },
      include: {
        adapter: true
      },
      orderBy: { createdAt: "desc" }
    });

    return jobs.map((job) => this.toPublishJobSummary(job));
  }

  async retryPublishJob(jobId: string) {
    const job = await this.prisma.socialPublishJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("找不到社群發布任務");
    }

    await this.tenancyService.assertTenantAccess(job.tenantId);

    await this.prisma.socialPublishJob.update({
      where: { id: jobId },
      data: {
        status: SocialPublishJobStatus.PUBLISHING,
        errorMessage: null
      }
    });

    return this.publishJobNow(jobId);
  }

  async publishJobNow(jobId: string) {
    const job = await this.prisma.socialPublishJob.findUnique({
      where: { id: jobId },
      include: {
        adapter: true,
        video: {
          include: {
            output: true
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("找不到社群發布任務");
    }

    await this.tenancyService.assertTenantAccess(job.tenantId);

    try {
      const result = await this.publishByPlatform(job);
      await this.prisma.socialPublishJob.update({
        where: { id: jobId },
        data: {
          status: SocialPublishJobStatus.SUCCESS,
          externalPostId: result.externalPostId,
          permalink: result.permalink,
          errorMessage: null
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "社群發布失敗";
      await this.prisma.socialPublishJob.update({
        where: { id: jobId },
        data: {
          status: SocialPublishJobStatus.FAILED,
          errorMessage: message
        }
      });
    }

    return this.getPublishJobDetail(jobId);
  }

  async getPublishJobDetail(jobId: string) {
    const job = await this.prisma.socialPublishJob.findUnique({
      where: { id: jobId },
      include: {
        adapter: true,
        video: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException("找不到社群發布任務");
    }

    return this.toPublishJobSummary(job);
  }

  async upsertAdapterFromBinding(input: {
    tenantId: string;
    platform: SocialPlatform;
    accountName: string;
    displayName: string;
    externalAccountId: string;
    accessToken: string;
    refreshToken?: string | null;
    scopes: string[];
    tokenExpiresAt?: Date | null;
    status?: SocialAdapterStatus;
  }) {
    return this.prisma.socialAdapter.upsert({
      where: {
        tenantId_platform_externalAccountId: {
          tenantId: input.tenantId,
          platform: input.platform,
          externalAccountId: input.externalAccountId
        }
      },
      create: {
        tenantId: input.tenantId,
        platform: input.platform,
        accountName: input.accountName,
        displayName: input.displayName,
        externalAccountId: input.externalAccountId,
        accessTokenEncrypted: this.tokenEncryption.encrypt(input.accessToken),
        refreshTokenEncrypted: input.refreshToken ? this.tokenEncryption.encrypt(input.refreshToken) : null,
        scopes: input.scopes,
        status: input.status ?? SocialAdapterStatus.ACTIVE,
        tokenExpiresAt: input.tokenExpiresAt ?? null
      },
      update: {
        accountName: input.accountName,
        displayName: input.displayName,
        accessTokenEncrypted: this.tokenEncryption.encrypt(input.accessToken),
        refreshTokenEncrypted: input.refreshToken ? this.tokenEncryption.encrypt(input.refreshToken) : null,
        scopes: input.scopes,
        status: input.status ?? SocialAdapterStatus.ACTIVE,
        tokenExpiresAt: input.tokenExpiresAt ?? null
      }
    });
  }

  async syncMetaAdapters(input: {
    tenantId: string;
    pages: MetaPage[];
    scopes: string[];
    tokenExpiresAt?: Date | null;
  }) {
    for (const page of input.pages) {
      if (!page.id || !page.access_token) {
        continue;
      }

      await this.upsertAdapterFromBinding({
        tenantId: input.tenantId,
        platform: SocialPlatform.FACEBOOK_PAGE,
        accountName: page.name,
        displayName: page.name,
        externalAccountId: page.id,
        accessToken: page.access_token,
        scopes: input.scopes,
        tokenExpiresAt: input.tokenExpiresAt ?? null
      });

      if (page.instagram_business_account?.id) {
        await this.upsertAdapterFromBinding({
          tenantId: input.tenantId,
          platform: SocialPlatform.INSTAGRAM,
          accountName: page.name,
          displayName: page.name,
          externalAccountId: page.instagram_business_account.id,
          accessToken: page.access_token,
          scopes: input.scopes,
          tokenExpiresAt: input.tokenExpiresAt ?? null
        });
      }
    }
  }

  async deleteAdapterByBinding(input: { tenantId: string | null; platform: string; externalAccountId: string | null }) {
    if (!input.tenantId || !input.externalAccountId) {
      return;
    }

    const mappedPlatform = this.mapPublishingPlatform(input.platform);
    if (!mappedPlatform) {
      return;
    }

    await this.prisma.socialAdapter.deleteMany({
      where: {
        tenantId: input.tenantId,
        platform: mappedPlatform,
        externalAccountId: input.externalAccountId
      }
    });
  }

  async syncManualAdapter(input: {
    tenantId: string;
    platform: string;
    accountName: string;
    displayName: string;
    externalAccountId: string | null;
    accessToken: string;
    refreshToken?: string | null;
    scopes: string[];
    expiresAt?: Date | null;
  }) {
    const platform = this.mapPublishingPlatform(input.platform);
    if (!platform || !input.externalAccountId) {
      return null;
    }

    return this.upsertAdapterFromBinding({
      tenantId: input.tenantId,
      platform,
      accountName: input.accountName,
      displayName: input.displayName,
      externalAccountId: input.externalAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      scopes: input.scopes,
      tokenExpiresAt: input.expiresAt ?? null
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueScheduledJobs() {
    const dueJobs = await this.prisma.socialPublishJob.findMany({
      where: {
        status: SocialPublishJobStatus.QUEUED,
        scheduledAt: {
          lte: new Date()
        }
      },
      select: { id: true },
      take: 20,
      orderBy: { scheduledAt: "asc" }
    });

    for (const job of dueJobs) {
      await this.prisma.socialPublishJob.update({
        where: { id: job.id },
        data: { status: SocialPublishJobStatus.PUBLISHING }
      });
      await this.publishJobNow(job.id);
    }
  }

  private async publishByPlatform(job: SocialPublishJob & { adapter: SocialAdapter; video: { output: { publicUrl: string | null } | null } }) {
    if (!job.video.output?.publicUrl) {
      throw new BadRequestException("影片尚未提供公開網址，無法發布");
    }

    switch (job.platform) {
      case SocialPlatform.FACEBOOK_PAGE:
        return this.publishToFacebook(job);
      case SocialPlatform.INSTAGRAM:
        return this.publishToInstagram(job);
      case SocialPlatform.THREADS:
        return this.publishToThreads(job);
      default:
        throw new BadRequestException("不支援的社群平台");
    }
  }

  private async publishToFacebook(job: SocialPublishJob & { adapter: SocialAdapter }) {
    const accessToken = this.tokenEncryption.decrypt(job.adapter.accessTokenEncrypted);
    const response = await this.fetchJson<{ id?: string; post_id?: string }>(
      `https://graph-video.facebook.com/v19.0/${job.adapter.externalAccountId}/videos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          access_token: accessToken,
          file_url: job.mediaUrl,
          description: job.caption
        }).toString()
      }
    );

    if (!response.id && !response.post_id) {
      throw new Error("Facebook 發布失敗：未取得貼文 ID");
    }

    return {
      externalPostId: response.post_id ?? response.id!,
      permalink: null
    } satisfies PublishResult;
  }

  private async publishToInstagram(job: SocialPublishJob & { adapter: SocialAdapter }) {
    const accessToken = this.tokenEncryption.decrypt(job.adapter.accessTokenEncrypted);
    const container = await this.fetchJson<{ id?: string }>(`https://graph.facebook.com/v19.0/${job.adapter.externalAccountId}/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        media_type: "REELS",
        video_url: job.mediaUrl,
        caption: job.caption,
        access_token: accessToken
      }).toString()
    });

    if (!container.id) {
      throw new Error("Instagram 發布失敗：無法建立 media container");
    }

    const published = await this.fetchJson<{ id?: string }>(
      `https://graph.facebook.com/v19.0/${job.adapter.externalAccountId}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: accessToken
        }).toString()
      }
    );

    if (!published.id) {
      throw new Error("Instagram 發布失敗：無法發佈 media");
    }

    const detail = await this.fetchJson<{ permalink?: string }>(
      `https://graph.facebook.com/v19.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );

    return {
      externalPostId: published.id,
      permalink: detail.permalink ?? null
    } satisfies PublishResult;
  }

  private async publishToThreads(job: SocialPublishJob & { adapter: SocialAdapter }) {
    const accessToken = this.tokenEncryption.decrypt(job.adapter.accessTokenEncrypted);
    const container = await this.fetchJson<{ id?: string }>(`https://graph.threads.net/v1.0/${job.adapter.externalAccountId}/threads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        media_type: "VIDEO",
        video_url: job.mediaUrl,
        text: job.caption,
        access_token: accessToken
      }).toString()
    });

    if (!container.id) {
      throw new Error("Threads 發布失敗：無法建立影片 container");
    }

    const published = await this.fetchJson<{ id?: string }>(
      `https://graph.threads.net/v1.0/${job.adapter.externalAccountId}/threads_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: accessToken
        }).toString()
      }
    );

    if (!published.id) {
      throw new Error("Threads 發布失敗：無法完成 publish");
    }

    const detail = await this.fetchJson<{ permalink?: string }>(
      `https://graph.threads.net/v1.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );

    return {
      externalPostId: published.id,
      permalink: detail.permalink ?? null
    } satisfies PublishResult;
  }

  private resolveMediaUrl(mediaUrl: string | null) {
    if (!mediaUrl) {
      throw new BadRequestException("發布前必須提供影片公開 HTTPS URL");
    }

    let parsed: URL;
    try {
      parsed = new URL(mediaUrl);
    } catch {
      throw new BadRequestException("影片 URL 必須是公開 HTTPS");
    }

    if (parsed.protocol !== "https:") {
      throw new BadRequestException("影片 URL 必須是公開 HTTPS");
    }

    return parsed.toString();
  }

  private toAdapterSummary(adapter: SocialAdapter) {
    return {
      id: adapter.id,
      tenantId: adapter.tenantId,
      platform: adapter.platform,
      accountName: adapter.accountName,
      displayName: adapter.displayName,
      externalAccountId: adapter.externalAccountId,
      scopes: adapter.scopes,
      status: adapter.status,
      tokenExpiresAt: adapter.tokenExpiresAt?.toISOString() ?? null,
      tokenPreview: this.maskToken(adapter.accessTokenEncrypted),
      createdAt: adapter.createdAt.toISOString(),
      updatedAt: adapter.updatedAt.toISOString()
    };
  }

  private toPublishJobSummary(
    job: SocialPublishJob & {
      adapter?: SocialAdapter | null;
      video?: { id: string; title: string; status: string } | null;
    }
  ) {
    return {
      id: job.id,
      tenantId: job.tenantId,
      videoId: job.videoId,
      platform: job.platform,
      adapterId: job.adapterId,
      adapterDisplayName: job.adapter?.displayName ?? null,
      adapterAccountName: job.adapter?.accountName ?? null,
      caption: job.caption,
      mediaUrl: job.mediaUrl,
      scheduledAt: job.scheduledAt?.toISOString() ?? null,
      status: job.status,
      externalPostId: job.externalPostId,
      permalink: job.permalink,
      errorMessage: job.errorMessage,
      video: job.video ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    };
  }

  private maskToken(encryptedToken: string) {
    try {
      const token = this.tokenEncryption.decrypt(encryptedToken);
      return `${token.slice(0, 4)}...${token.slice(-4)}`;
    } catch {
      return "****";
    }
  }

  private mapPublishingPlatform(platform: string) {
    switch (platform) {
      case "FACEBOOK":
        return SocialPlatform.FACEBOOK_PAGE;
      case "INSTAGRAM":
        return SocialPlatform.INSTAGRAM;
      case "THREADS":
        return SocialPlatform.THREADS;
      default:
        return null;
    }
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const raw = await response.text();

    if (!response.ok) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string; type?: string; code?: number } };
        const message = parsed.error?.message ?? raw;
        throw new Error(message);
      } catch (error) {
        if (error instanceof Error && error.message !== raw) {
          throw error;
        }
        throw new Error(raw || `HTTP ${response.status}`);
      }
    }

    if (!raw) {
      return {} as T;
    }

    return JSON.parse(raw) as T;
  }
}
