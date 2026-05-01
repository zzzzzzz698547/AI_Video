import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ChannelAdapterType,
  MetaDataDeletionRequest,
  MetaDataDeletionStatus,
  PlatformAccount,
  PublishingPlatform,
  Prisma
} from "@prisma/client";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

type SignedRequestPayload = Record<string, unknown>;

type MetaDeletionSummary = {
  deletedPlatformAccounts: number;
  deletedPlatformTokens: number;
  deletedChannelAdapters: number;
};

@Injectable()
export class MetaDataDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  async handleCallback(input: {
    signedRequest: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const payload = this.verifySignedRequest(input.signedRequest);
    const metaUserId = this.resolveMetaUserId(payload);
    if (!metaUserId) {
      throw new BadRequestException("Missing Meta user id in signed_request payload");
    }

    const confirmationCode = this.createConfirmationCode(metaUserId);
    const callbackUrl = this.buildCallbackUrl();
    const statusUrl = this.buildStatusUrl(confirmationCode);

    const requestRecord = await this.prisma.metaDataDeletionRequest.create({
      data: {
        metaUserId,
        confirmationCode,
        status: "PROCESSING",
        callbackUrl,
        statusUrl,
        signedRequest: payload as Prisma.InputJsonValue,
        requestPayload: {
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null
        } as Prisma.InputJsonValue,
        metadata: {
          receivedAt: new Date().toISOString()
        } as Prisma.InputJsonValue
      }
    });

    try {
      const summary = await this.deleteMetaLinkedData(metaUserId);
      const status: MetaDataDeletionStatus =
        summary.deletedPlatformAccounts > 0 || summary.deletedPlatformTokens > 0
          ? "COMPLETED"
          : "NOT_FOUND";

      await this.prisma.metaDataDeletionRequest.update({
        where: { id: requestRecord.id },
        data: {
          status,
          deletedPlatformAccounts: summary.deletedPlatformAccounts,
          deletedPlatformTokens: summary.deletedPlatformTokens,
          deletedChannelAdapters: summary.deletedChannelAdapters,
          responsePayload: {
            status,
            confirmationCode,
            statusUrl
          } as Prisma.InputJsonValue,
          completedAt: new Date(),
          metadata: {
            receivedAt: new Date().toISOString(),
            processedAt: new Date().toISOString()
          } as Prisma.InputJsonValue
        }
      });

      return {
        confirmationCode,
        statusUrl,
        status,
        ...summary
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown deletion error";
      await this.prisma.metaDataDeletionRequest.update({
        where: { id: requestRecord.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          responsePayload: {
            status: "FAILED",
            message
          } as Prisma.InputJsonValue,
          completedAt: new Date()
        }
      });
      throw new BadRequestException(message);
    }
  }

  async getStatus(code: string) {
    const confirmationCode = code.trim();
    if (!confirmationCode) {
      throw new BadRequestException("Missing confirmation code");
    }

    const request = await this.prisma.metaDataDeletionRequest.findUnique({
      where: { confirmationCode }
    });

    if (!request) {
      throw new NotFoundException("Data deletion request not found");
    }

    return this.toStatusPayload(request);
  }

  private async deleteMetaLinkedData(metaUserId: string): Promise<MetaDeletionSummary> {
    return this.prisma.$transaction(async (tx) => {
      const accounts = await tx.platformAccount.findMany({
        include: { token: true }
      });

      const matchedAccounts = accounts.filter((account) => this.matchesMetaUserId(account, metaUserId));

      const affectedGroups = new Map<
        string,
        { workspaceId: string | null; brandId: string | null; platform: PublishingPlatform }
      >();

      let deletedPlatformAccounts = 0;
      let deletedPlatformTokens = 0;

      for (const account of matchedAccounts) {
        affectedGroups.set(this.groupKey(account.workspaceId ?? null, account.brandId ?? null, account.platform), {
          workspaceId: account.workspaceId ?? null,
          brandId: account.brandId ?? null,
          platform: account.platform
        });

        if (account.token) {
          await tx.platformToken.delete({
            where: { platformAccountId: account.id }
          });
          deletedPlatformTokens += 1;
        }

        await tx.platformAccount.delete({
          where: { id: account.id }
        });
        deletedPlatformAccounts += 1;
      }

      let deletedChannelAdapters = 0;
      for (const group of affectedGroups.values()) {
        deletedChannelAdapters += await this.syncChannelAdapterAfterDeletion(tx, group);
      }

      return {
        deletedPlatformAccounts,
        deletedPlatformTokens,
        deletedChannelAdapters
      };
    });
  }

  private async syncChannelAdapterAfterDeletion(
    tx: Prisma.TransactionClient,
    group: { workspaceId: string | null; brandId: string | null; platform: PublishingPlatform }
  ) {
    const adapterType = this.resolveAdapterType(group.platform);
    if (!adapterType || !group.workspaceId) {
      return 0;
    }

    const adapter = await tx.channelAdapter.findFirst({
      where: {
        workspaceId: group.workspaceId,
        brandId: group.brandId ?? undefined,
        adapterType
      },
      select: { id: true }
    });

    if (!adapter) {
      return 0;
    }

    const remainingAccounts = await tx.platformAccount.findMany({
      where: {
        workspaceId: group.workspaceId,
        brandId: group.brandId ?? undefined,
        platform: group.platform,
        isActive: true
      },
      orderBy: { updatedAt: "desc" }
    });

    if (remainingAccounts.length > 0) {
      await tx.channelAdapter.update({
        where: { id: adapter.id },
        data: {
          externalAccountId: remainingAccounts[0]?.externalAccountId ?? null,
          status: "ACTIVE",
          lastSyncedAt: new Date(),
          metadata: {
            syncedFrom: "meta-data-deletion",
            updatedAt: new Date().toISOString()
          } as Prisma.InputJsonValue
        }
      });
      return 1;
    }

    await tx.channelAdapter.update({
      where: { id: adapter.id },
      data: {
        externalAccountId: null,
        status: "PAUSED",
        lastSyncedAt: new Date(),
        metadata: {
          syncedFrom: "meta-data-deletion",
          updatedAt: new Date().toISOString()
        } as Prisma.InputJsonValue
      }
    });
    return 1;
  }

  private matchesMetaUserId(
    account: PlatformAccount & {
      token: {
        accessTokenEncrypted: string;
        refreshTokenEncrypted: string | null;
        expiresAt: Date | null;
        scopes: string[];
        metadata: unknown;
      } | null;
    },
    metaUserId: string
  ) {
    const accountMetadata = this.extractMetadata(account.metadata);
    const tokenMetadata = this.extractMetadata(account.token?.metadata);

    return (
      account.externalAccountId === metaUserId ||
      accountMetadata?.metaUserId === metaUserId ||
      tokenMetadata?.metaUserId === metaUserId ||
      tokenMetadata?.pageId === metaUserId ||
      tokenMetadata?.channelId === metaUserId
    );
  }

  private toStatusPayload(request: MetaDataDeletionRequest) {
    return {
      confirmationCode: request.confirmationCode,
      metaUserId: request.metaUserId,
      status: request.status,
      callbackUrl: request.callbackUrl,
      statusUrl: request.statusUrl,
      deletedPlatformAccounts: request.deletedPlatformAccounts,
      deletedPlatformTokens: request.deletedPlatformTokens,
      deletedChannelAdapters: request.deletedChannelAdapters,
      errorMessage: request.errorMessage,
      requestedAt: request.createdAt.toISOString(),
      completedAt: request.completedAt ? request.completedAt.toISOString() : null
    };
  }

  private verifySignedRequest(signedRequest: string) {
    const [signaturePart, payloadPart] = signedRequest.split(".", 2);
    if (!signaturePart || !payloadPart) {
      throw new BadRequestException("Invalid signed_request payload");
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      throw new BadRequestException("Meta OAuth 尚未設定 META_APP_SECRET");
    }

    const expectedSignature = createHmac("sha256", appSecret).update(payloadPart).digest();
    const actualSignature = this.base64UrlDecode(signaturePart);
    if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
      throw new BadRequestException("Invalid Meta signed_request signature");
    }

    const payloadJson = this.base64UrlDecode(payloadPart).toString("utf8");
    const payload = JSON.parse(payloadJson) as SignedRequestPayload;
    return payload;
  }

  private resolveMetaUserId(payload: SignedRequestPayload) {
    const candidate = payload.user_id ?? payload.userId ?? payload.facebook_user_id ?? payload.id;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }

    return null;
  }

  private createConfirmationCode(metaUserId: string) {
    const randomPart = randomBytes(6).toString("hex").toUpperCase();
    const userPart = metaUserId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-6);
    return `MDD${userPart}${randomPart}`.slice(0, 32);
  }

  private buildCallbackUrl() {
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3001";
    return `${baseUrl.replace(/\/$/, "")}/meta/data-deletion`;
  }

  private buildStatusUrl(confirmationCode: string) {
    const baseUrl = process.env.WEB_BASE_URL ?? process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";
    return `${baseUrl.replace(/\/$/, "")}/meta/data-deletion-status/${encodeURIComponent(confirmationCode)}`;
  }

  private resolveAdapterType(platform: PublishingPlatform): ChannelAdapterType | null {
    switch (platform) {
      case "FACEBOOK":
        return "FACEBOOK_MESSENGER";
      case "INSTAGRAM":
        return "INSTAGRAM_DM";
      default:
        return null;
    }
  }

  private extractMetadata(metadata: unknown) {
    return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  }

  private groupKey(workspaceId: string | null, brandId: string | null, platform: PublishingPlatform) {
    return `${workspaceId ?? "none"}::${brandId ?? "none"}::${platform}`;
  }

  private base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4;
    const padded = padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
    return Buffer.from(padded, "base64");
  }
}
