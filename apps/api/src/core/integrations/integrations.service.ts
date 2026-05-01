import { BadRequestException, Injectable } from "@nestjs/common";
import type { ChannelAdapterType, PlatformAccount, PublishingPlatform, Prisma } from "@prisma/client";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { TenancyService } from "../tenancy/tenancy.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenEncryptionService } from "../../shared/token-encryption.service";
import { SocialService } from "../../social/social.service";
import type {
  CallbackIntegrationInput,
  ConnectIntegrationInput,
  ConnectIntegrationResult,
  IntegrationPermissionStage,
  IntegrationPermissionStageKey,
  IntegrationAccountSummary,
  IntegrationProviderDefinition,
  IntegrationProviderStatus,
  ManualBindIntegrationInput
} from "./integrations.types";

type BindState = {
  workspaceId: string;
  brandId?: string;
  platform: PublishingPlatform;
  accountName?: string;
  ts: number;
  nonce: string;
};

type ManualBindReadResult = {
  accountName: string;
  displayName: string;
  externalAccountId: string | null;
  readSource: string;
  readDetails: Prisma.InputJsonValue;
};

const PROVIDER_LABELS: Record<PublishingPlatform, string> = {
  FACEBOOK: "Facebook Page",
  INSTAGRAM: "Instagram Professional",
  THREADS: "Threads",
  YOUTUBE: "YouTube"
};

const PROVIDER_SOURCES: Record<PublishingPlatform, "META" | "LINE" | "GOOGLE"> = {
  FACEBOOK: "META",
  INSTAGRAM: "META",
  THREADS: "META",
  YOUTUBE: "GOOGLE"
};

const PROVIDER_BASE_SCOPES: Record<PublishingPlatform, string[]> = {
  // 基礎綁定只抓最小權限，避免一開始就被尚未核可的進階 scope 擋掉。
  FACEBOOK: ["pages_show_list"],
  INSTAGRAM: ["instagram_basic"],
  THREADS: ["threads_basic"],
  YOUTUBE: ["https://www.googleapis.com/auth/youtube.readonly"]
};

const PROVIDER_PERMISSION_STAGES: Record<PublishingPlatform, IntegrationPermissionStage[]> = {
  FACEBOOK: [
    {
      key: "PUBLISH",
      label: "發文權限",
      description: "允許排程與發佈貼文",
      scopes: ["pages_manage_posts"],
      supported: true
    },
    {
      key: "ENGAGEMENT",
      label: "留言 / 互動權限",
      description: "允許讀取貼文互動與貼文成效",
      scopes: ["pages_read_engagement"],
      supported: true
    },
    {
      key: "MESSAGING",
      label: "Messenger / 私訊權限",
      description: "允許啟用 Messenger 訊息接收",
      scopes: ["pages_messaging"],
      supported: true
    }
  ],
  INSTAGRAM: [
    {
      key: "PUBLISH",
      label: "發文權限",
      description: "允許發佈 Instagram 內容",
      scopes: ["instagram_content_publish"],
      supported: true
    },
    {
      key: "ENGAGEMENT",
      label: "留言 / 互動權限",
      description: "允許讀取貼文互動",
      scopes: ["pages_read_engagement"],
      supported: true
    },
    {
      key: "MESSAGING",
      label: "DM 權限",
      description: "允許收發 Instagram 私訊",
      scopes: ["instagram_manage_messages"],
      supported: true
    }
  ],
  THREADS: [
    {
      key: "PUBLISH",
      label: "發文權限",
      description: "允許發佈 Threads 內容",
      scopes: ["threads_content_publish"],
      supported: true
    },
    {
      key: "ENGAGEMENT",
      label: "留言 / 互動權限",
      description: "允許讀取互動資料",
      scopes: [],
      supported: false
    },
    {
      key: "MESSAGING",
      label: "私訊權限",
      description: "Threads 暫不支援私訊授權",
      scopes: [],
      supported: false
    }
  ],
  YOUTUBE: [
    {
      key: "PUBLISH",
      label: "上傳權限",
      description: "允許上傳影片",
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      supported: true
    },
    {
      key: "ENGAGEMENT",
      label: "觀看 / 讀取權限",
      description: "允許讀取頻道與影片資料",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
      supported: true
    },
    {
      key: "MESSAGING",
      label: "私訊權限",
      description: "YouTube 不提供私訊授權",
      scopes: [],
      supported: false
    }
  ]
};

const CHANNEL_ADAPTER_MAP: Partial<Record<PublishingPlatform, ChannelAdapterType>> = {
  FACEBOOK: "FACEBOOK_MESSENGER",
  INSTAGRAM: "INSTAGRAM_DM"
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyService: TenancyService,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly socialService: SocialService
  ) {}

  listProviders(): IntegrationProviderDefinition[] {
    return (Object.keys(PROVIDER_LABELS) as PublishingPlatform[]).map((platform) => ({
      platform,
      label: PROVIDER_LABELS[platform],
      provider: PROVIDER_SOURCES[platform],
      description: this.resolveDescription(platform),
      callbackPath: `/integrations/callback/${platform.toLowerCase()}`,
      scopes: PROVIDER_BASE_SCOPES[platform],
      permissionStages: PROVIDER_PERMISSION_STAGES[platform],
      status: this.resolveProviderStatus(platform),
      mode: this.isMockMode() ? "MOCK" : "OAUTH"
    }));
  }

  async listAccounts(workspaceId?: string, brandId?: string, platform?: string) {
    const tenantId = await this.resolveTenantIdForWorkspace(workspaceId);
    await this.tenancyService.assertTenantAccess(tenantId);
    const normalizedPlatform = this.normalizePlatform(platform);
    const accounts = await this.prisma.platformAccount.findMany({
      where: {
        workspaceId: workspaceId ?? undefined,
        brandId: brandId ?? undefined,
        platform: normalizedPlatform ?? undefined
      },
      include: {
        token: true
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    const summaries = await Promise.all(accounts.map((account) => this.toSummary(account)));
    return summaries;
  }

  async buildConnectLink(input: ConnectIntegrationInput): Promise<ConnectIntegrationResult> {
    const tenantId = await this.resolveTenantIdForWorkspace(input.workspaceId);
    await this.tenancyService.assertTenantAccess(tenantId);
    const platform = this.normalizePlatform(input.platform);
    if (!platform) {
      throw new Error("Missing platform");
    }
    const permissionStage = this.normalizePermissionStage(input.permissionStage);
    const scopes = this.resolveScopes(platform, permissionStage);
    const mockMode = this.isMockMode();
    const mockExternalAccountId = `${platform.toLowerCase()}-${this.createNonce().slice(0, 10)}`;
    const state = this.encodeState({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform,
      accountName: input.accountName,
      ts: Date.now(),
      nonce: this.createNonce()
    });

    const callbackUrl = this.buildCallbackUrl(platform);
    const authUrl = mockMode
      ? `${callbackUrl}&code=mock-${platform.toLowerCase()}-${this.createNonce().slice(0, 12)}&externalAccountId=${encodeURIComponent(
          mockExternalAccountId
        )}&displayName=${encodeURIComponent(input.accountName ?? PROVIDER_LABELS[platform])}`
      : this.buildAuthorizationUrl({
          platform,
          state,
          callbackUrl,
          scopes
        });

    return {
      platform,
      mode: mockMode ? "MOCK" : "OAUTH",
      provider: PROVIDER_SOURCES[platform],
      authUrl,
      callbackUrl,
      scopes,
      state,
      redirectUri: callbackUrl,
      permissionStage: permissionStage ?? "BASE"
    };
  }

  async openConnectLink(input: ConnectIntegrationInput) {
    const result = await this.buildConnectLink(input);
    const launched = this.openPrivateBrowser(result.authUrl);

    return {
      ...result,
      opened: launched
    };
  }

  async handleCallback(input: CallbackIntegrationInput) {
    const platform = this.normalizePlatform(input.platform);
    if (!platform) {
      throw new Error("Missing platform");
    }
    const state = this.decodeState(input.state);
    const workspaceId = state?.workspaceId;
    if (!workspaceId) {
      throw new Error("Missing workspaceId in OAuth state");
    }

    await this.tenancyService.assertTenantAccess(await this.resolveTenantIdForWorkspace(workspaceId));

    const brandId = state?.brandId ?? null;
    const accountName = state?.accountName ?? PROVIDER_LABELS[platform];
    const mockMode = this.isMockMode();

    await this.ensureWorkspaceContext(workspaceId, brandId);

    if (mockMode) {
      return this.handleMockCallback({
        platform,
        workspaceId,
        brandId,
        accountName,
        code: input.code,
        externalAccountId: input.externalAccountId,
        displayName: input.displayName
      });
    }

    if (platform === "YOUTUBE") {
      return this.handleYoutubeCallback({
        workspaceId,
        brandId,
        accountName,
        code: input.code,
        state: input.state,
        externalAccountId: input.externalAccountId,
        displayName: input.displayName
      });
    }

    return this.handleMetaCallback({
      platform,
      workspaceId,
      brandId,
      accountName,
      code: input.code,
      state: input.state,
      externalAccountId: input.externalAccountId,
      displayName: input.displayName
    });
  }

  async manualBind(input: ManualBindIntegrationInput) {
    const tenantId = await this.resolveTenantIdForWorkspace(input.workspaceId);
    await this.tenancyService.assertTenantAccess(tenantId);
    const platform = this.normalizePlatform(input.platform);
    if (!platform) {
      throw new Error("Missing platform");
    }

    await this.ensureWorkspaceContext(input.workspaceId, input.brandId ?? null);

    const accountName = input.accountName?.trim();
    const scopes = this.normalizeScopesInput(input.scopes) ?? this.resolveScopes(platform);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    if (!accountName) {
      throw new BadRequestException("accountName 不可為空");
    }
    if (!input.accessToken?.trim()) {
      throw new BadRequestException("accessToken 不可為空");
    }

    const readResult = await this.readManualBindAccount({
      platform,
      accessToken: input.accessToken.trim(),
      externalAccountId: input.externalAccountId?.trim() || null,
      displayName: input.displayName?.trim() || null,
      accountName
    });

    const metadata = {
      ...(input.metadata ?? {}),
      mode: "MANUAL",
      provider: PROVIDER_SOURCES[platform],
      manualAt: new Date().toISOString(),
      manualBy: "admin-dashboard",
      verification: {
        status: "SUCCESS",
        source: readResult.readSource,
        accountName: readResult.accountName,
        displayName: readResult.displayName,
        externalAccountId: readResult.externalAccountId,
        details: readResult.readDetails
      }
    } as Prisma.InputJsonValue;

    const account = await this.upsertPlatformAccount({
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      platform,
      accountName: readResult.accountName,
      displayName: readResult.displayName,
      externalAccountId: readResult.externalAccountId,
      isActive: true,
      metadata
    });

    await this.upsertPlatformToken({
      accountId: account.id,
      accessToken: input.accessToken.trim(),
      refreshToken: input.refreshToken?.trim() ?? null,
      expiresAt,
      scopes,
      metadata: {
        mode: "MANUAL",
        provider: PROVIDER_SOURCES[platform],
        externalAccountId: readResult.externalAccountId,
        manualAt: new Date().toISOString(),
        verification: {
          status: "SUCCESS",
          source: readResult.readSource,
          accountName: readResult.accountName,
          displayName: readResult.displayName,
          details: readResult.readDetails
        }
      } as Prisma.InputJsonValue
    });

    await this.upsertChannelAdapter({
      workspaceId: input.workspaceId,
      brandId: input.brandId ?? null,
      platform,
      externalAccountId: readResult.externalAccountId,
      displayName: readResult.displayName,
      adapterStatus: input.adapterStatus ?? "PAUSED",
      config: {
        mode: "MANUAL",
        manual: true,
        scopes,
        verification: {
          status: "SUCCESS",
          source: readResult.readSource,
          accountName: readResult.accountName,
          displayName: readResult.displayName
        }
      } as Prisma.InputJsonValue
    });

    if (tenantId) {
      await this.socialService.syncManualAdapter({
        tenantId,
        platform,
        accountName: readResult.accountName,
        displayName: readResult.displayName,
        externalAccountId: readResult.externalAccountId,
        accessToken: input.accessToken.trim(),
        refreshToken: input.refreshToken?.trim() ?? null,
        scopes,
        expiresAt
      });
    }

    const createdAccount = await this.findAccountSummary(account.id);
    if (!createdAccount) {
      throw new Error("Platform account not found after manual bind");
    }

    return {
      ...(await this.toSummary(createdAccount)),
      readStatus: "SUCCESS" as const,
      readAccountName: readResult.accountName,
      readDisplayName: readResult.displayName,
      readSource: readResult.readSource
    };
  }

  async refreshToken(accountId: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
      include: { token: true }
    });

    if (!account?.token) {
      throw new Error("Platform account or token not found");
    }

    await this.tenancyService.assertTenantAccess(account.tenantId);

    const mockMode = this.isMockMode();
    const tokenUpdate = mockMode
      ? {
          accessToken: `${mockMode ? "mock" : "oauth"}-refreshed-${account.platform.toLowerCase()}-${this.createNonce().slice(0, 12)}`,
          refreshToken: account.token.refreshTokenEncrypted
            ? this.tokenEncryption.decrypt(account.token.refreshTokenEncrypted)
            : null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          metadata: {
            ...this.extractMetadata(account.token.metadata),
            refreshedAt: new Date().toISOString(),
            mode: mockMode ? "MOCK" : "OAUTH"
          }
        }
      : await this.refreshOfficialToken(account);

    await this.prisma.platformToken.update({
      where: { platformAccountId: account.id },
      data: {
        accessTokenEncrypted: this.tokenEncryption.encrypt(tokenUpdate.accessToken),
        refreshTokenEncrypted: tokenUpdate.refreshToken ? this.tokenEncryption.encrypt(tokenUpdate.refreshToken) : null,
        expiresAt: tokenUpdate.expiresAt,
        metadata: tokenUpdate.metadata
      }
    });

    await this.touchChannelAdapter(account.workspaceId, account.brandId, account.platform, account.externalAccountId);

    const refreshedAccount = await this.prisma.platformAccount.findUnique({
      where: { id: account.id },
      include: { token: true }
    });
    if (!refreshedAccount) {
      throw new Error("Platform account not found after refresh");
    }

    return this.toSummary(refreshedAccount);
  }

  async disconnect(accountId: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
      include: { token: true }
    });

    if (!account) {
      throw new Error("Platform account not found");
    }

    await this.tenancyService.assertTenantAccess(account.tenantId);

    await this.prisma.platformAccount.update({
      where: { id: accountId },
      data: {
        isActive: false,
        metadata: {
          disconnectedAt: new Date().toISOString()
        }
      }
    });

    await this.revokeOfficialToken(account);

    await this.prisma.platformToken.deleteMany({
      where: { platformAccountId: accountId }
    });

    await this.socialService.deleteAdapterByBinding({
      tenantId: account.tenantId,
      platform: account.platform,
      externalAccountId: account.externalAccountId
    });

    await this.syncAdapterAfterAccountChange(account.workspaceId, account.brandId, account.platform);

    const disconnectedAccount = await this.prisma.platformAccount.findUnique({
      where: { id: account.id },
      include: { token: true }
    });
    if (!disconnectedAccount) {
      throw new Error("Platform account not found after disconnect");
    }

    return this.toSummary(disconnectedAccount);
  }

  async deleteAccount(accountId: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: accountId },
      include: { token: true }
    });

    if (!account) {
      throw new Error("Platform account not found");
    }

    await this.tenancyService.assertTenantAccess(account.tenantId);

    const adapterType = CHANNEL_ADAPTER_MAP[account.platform];
    const platform = account.platform;
    const workspaceId = account.workspaceId;
    const brandId = account.brandId;

    await this.revokeOfficialToken(account);

    await this.prisma.platformToken.deleteMany({
      where: { platformAccountId: accountId }
    });

    await this.prisma.platformAccount.delete({
      where: { id: accountId }
    });

    await this.socialService.deleteAdapterByBinding({
      tenantId: account.tenantId,
      platform: account.platform,
      externalAccountId: account.externalAccountId
    });

    await this.syncAdapterAfterAccountChange(workspaceId, brandId, platform);

    return {
      id: accountId,
      deleted: true
    };
  }

  private async handleMockCallback(input: {
    platform: PublishingPlatform;
    workspaceId: string;
    brandId: string | null;
    accountName: string;
    code: string;
    externalAccountId?: string;
    displayName?: string;
  }) {
    const externalAccountId = input.externalAccountId ?? `${input.platform.toLowerCase()}-${this.createNonce().slice(0, 10)}`;
    const displayName = input.displayName ?? `${input.accountName} (${input.platform})`;
    const accessToken = `mock-access-token-${input.platform.toLowerCase()}-${input.code}`;
    const refreshToken = `mock-refresh-token-${input.platform.toLowerCase()}-${input.code}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const account = await this.upsertPlatformAccount({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform: input.platform,
      accountName: input.accountName,
      displayName,
      externalAccountId,
      isActive: true,
      metadata: {
        mode: "MOCK",
        connectedFrom: "integrations-callback"
      } as Prisma.InputJsonValue
    });

    await this.upsertPlatformToken({
      accountId: account.id,
      accessToken,
      refreshToken,
      expiresAt,
      scopes: this.resolveScopes(input.platform),
      metadata: {
        code: input.code,
        mode: "MOCK"
      } as Prisma.InputJsonValue
    });

    await this.upsertChannelAdapter({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform: input.platform,
      externalAccountId,
      displayName
    });

    const createdAccount = await this.findAccountSummary(account.id);
    if (!createdAccount) {
      throw new Error("Platform account not found after connect");
    }

    return this.toSummary(createdAccount);
  }

  private async handleMetaCallback(input: {
    platform: PublishingPlatform;
    workspaceId: string;
    brandId: string | null;
    accountName: string;
    code: string;
    state?: string;
    externalAccountId?: string;
    displayName?: string;
  }) {
    const metaConfig = this.getMetaConfig();
    const callbackUrl = this.buildCallbackUrl(input.platform);
    const shortLived = await this.exchangeMetaCodeForToken({
      code: input.code,
      callbackUrl,
      config: metaConfig
    });
    const longLived = await this.exchangeMetaLongLivedToken(shortLived.accessToken, metaConfig);
    const profile = await this.fetchMetaProfile(longLived.accessToken, metaConfig);
    const pages = await this.fetchMetaPages(longLived.accessToken, metaConfig);
    const binding = this.selectMetaBinding(input.platform, profile, pages, input);

    const account = await this.upsertPlatformAccount({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform: input.platform,
      accountName: input.accountName,
      displayName: binding.displayName,
      externalAccountId: binding.externalAccountId,
      isActive: true,
      metadata: {
        mode: "OAUTH",
        provider: "META",
        metaUserId: profile.id,
        metaUserName: profile.name,
        selectedPageId: binding.pageId ?? null,
        selectedPageName: binding.pageName ?? null,
        pages: pages.map((page) => ({
          id: page.id,
          name: page.name,
          instagramBusinessAccountId: page.instagram_business_account?.id ?? null
        }))
      } as Prisma.InputJsonValue
    });

    await this.upsertPlatformToken({
      accountId: account.id,
      accessToken: longLived.accessToken,
      refreshToken: null,
      expiresAt: longLived.expiresAt,
      scopes: this.resolveScopes(input.platform),
      metadata: {
        mode: "OAUTH",
        provider: "META",
        metaUserId: profile.id,
        pageId: binding.pageId ?? null,
        pageName: binding.pageName ?? null,
        instagramBusinessAccountId: binding.instagramBusinessAccountId ?? null,
        selectedPlatform: input.platform
      } as Prisma.InputJsonValue
    });

    await this.upsertChannelAdapter({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform: input.platform,
      externalAccountId: binding.externalAccountId,
      displayName: binding.displayName
    });

    const tenantId = await this.resolveTenantIdForWorkspace(input.workspaceId);
    if (tenantId) {
      await this.socialService.syncMetaAdapters({
        tenantId,
        pages,
        scopes: [
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_posts",
          "instagram_basic",
          "instagram_content_publish"
        ],
        tokenExpiresAt: longLived.expiresAt
      });
    }

    const createdAccount = await this.findAccountSummary(account.id);
    if (!createdAccount) {
      throw new Error("Platform account not found after connect");
    }

    return this.toSummary(createdAccount);
  }

  private async handleYoutubeCallback(input: {
    workspaceId: string;
    brandId: string | null;
    accountName: string;
    code: string;
    state?: string;
    externalAccountId?: string;
    displayName?: string;
  }) {
    const googleConfig = this.getGoogleConfig();
    const callbackUrl = this.buildCallbackUrl("YOUTUBE");
    const tokenResponse = await this.exchangeGoogleCodeForToken({
      code: input.code,
      callbackUrl,
      config: googleConfig
    });
    const channel = await this.fetchYoutubeChannel(tokenResponse.accessToken);
    const displayName = input.displayName ?? channel.title ?? input.accountName;

    const account = await this.upsertPlatformAccount({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      platform: "YOUTUBE",
      accountName: input.accountName,
      displayName,
      externalAccountId: input.externalAccountId ?? channel.id,
      isActive: true,
      metadata: {
        mode: "OAUTH",
        provider: "GOOGLE",
        channelTitle: channel.title,
        channelThumbnail: channel.thumbnailUrl
      } as Prisma.InputJsonValue
    });

    await this.upsertPlatformToken({
      accountId: account.id,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken ?? null,
      expiresAt: tokenResponse.expiresAt,
      scopes: this.resolveScopes("YOUTUBE"),
      metadata: {
        mode: "OAUTH",
        provider: "GOOGLE",
        channelId: channel.id,
        tokenType: "google-oauth"
      } as Prisma.InputJsonValue
    });

    const createdAccount = await this.findAccountSummary(account.id);
    if (!createdAccount) {
      throw new Error("Platform account not found after connect");
    }

    return this.toSummary(createdAccount);
  }

  private async readManualBindAccount(input: {
    platform: PublishingPlatform;
    accessToken: string;
    externalAccountId: string | null;
    displayName: string | null;
    accountName: string;
  }): Promise<ManualBindReadResult> {
    if (input.platform === "YOUTUBE") {
      const channel = await this.fetchYoutubeChannel(input.accessToken);
      if (!channel.id) {
        throw new BadRequestException("讀取失敗：YouTube 頻道資料不足");
      }

      const resolvedDisplayName = input.displayName ?? channel.title ?? input.accountName;
      return {
        accountName: channel.title ?? input.accountName,
        displayName: resolvedDisplayName,
        externalAccountId: input.externalAccountId ?? channel.id,
        readSource: "YouTube API",
        readDetails: {
          channelId: channel.id,
          channelTitle: channel.title,
          channelThumbnail: channel.thumbnailUrl
        } as Prisma.InputJsonValue
      };
    }

    const metaConfig = this.getMetaConfig();
    const profile = await this.fetchMetaProfile(input.accessToken, metaConfig);
    const pages = await this.fetchMetaPages(input.accessToken, metaConfig);

    if (input.platform === "FACEBOOK") {
      if (pages.length === 0) {
        throw new BadRequestException("讀取失敗：無法讀取 Facebook 粉專，請確認 pages_show_list 權限或改用粉專 token");
      }

      const matchedPage =
        input.externalAccountId ? pages.find((page) => page.id === input.externalAccountId || page.name === input.externalAccountId) : undefined;
      const selectedPage = matchedPage ?? pages[0];
      if (!selectedPage) {
        throw new BadRequestException("讀取失敗：找不到可用的 Facebook 粉專");
      }

      const resolvedDisplayName = input.displayName ?? selectedPage.name ?? profile.name;
      return {
        accountName: selectedPage.name ?? input.accountName,
        displayName: resolvedDisplayName,
        externalAccountId: selectedPage.id,
        readSource: "Meta Graph API",
        readDetails: {
          profileId: profile.id,
          profileName: profile.name,
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          instagramBusinessAccountId: selectedPage.instagram_business_account?.id ?? null
        } as Prisma.InputJsonValue
      };
    }

    if (input.platform === "INSTAGRAM") {
      const matchedPage = input.externalAccountId
        ? pages.find((page) => page.instagram_business_account?.id === input.externalAccountId || page.id === input.externalAccountId)
        : undefined;
      const instagramPage = matchedPage ?? pages.find((page) => page.instagram_business_account?.id);
      const instagramBusinessAccountId = instagramPage?.instagram_business_account?.id ?? null;

      if (!instagramPage || !instagramBusinessAccountId) {
        throw new BadRequestException("讀取失敗：無法讀取 Instagram 商業帳號，請確認 pages_show_list / instagram_basic 權限");
      }

      const resolvedDisplayName = input.displayName ?? instagramPage.name ?? profile.name;
      return {
        accountName: instagramPage.name ?? input.accountName,
        displayName: resolvedDisplayName,
        externalAccountId: instagramBusinessAccountId,
        readSource: "Meta Graph API",
        readDetails: {
          profileId: profile.id,
          profileName: profile.name,
          pageId: instagramPage.id,
          pageName: instagramPage.name,
          instagramBusinessAccountId
        } as Prisma.InputJsonValue
      };
    }

    const resolvedDisplayName = input.displayName ?? profile.name;
    return {
      accountName: profile.name ?? input.accountName,
      displayName: resolvedDisplayName,
      externalAccountId: input.externalAccountId ?? profile.id,
      readSource: "Meta Graph API",
      readDetails: {
        profileId: profile.id,
        profileName: profile.name
      } as Prisma.InputJsonValue
    };
  }

  async disconnectAll(input: { workspaceId?: string; brandId?: string; platform?: string }) {
    await this.tenancyService.assertTenantAccess(await this.resolveTenantIdForWorkspace(input.workspaceId));
    const normalizedPlatform = this.normalizePlatform(input.platform);
    const accounts = await this.prisma.platformAccount.findMany({
      where: {
        workspaceId: input.workspaceId ?? undefined,
        brandId: input.brandId ?? undefined,
        platform: normalizedPlatform ?? undefined
      },
      select: { id: true, platform: true, workspaceId: true, brandId: true }
    });

    let disconnected = 0;
    for (const account of accounts) {
      await this.disconnect(account.id);
      disconnected += 1;
    }

    return {
      disconnected,
      workspaceId: input.workspaceId ?? null,
      brandId: input.brandId ?? null,
      platform: normalizedPlatform ?? null
    };
  }

  private normalizePlatform(platform?: PublishingPlatform | string | null) {
    if (!platform) {
      return undefined;
    }

    const normalized = platform.toString().trim().toUpperCase();
    if (normalized in PROVIDER_LABELS) {
      return normalized as PublishingPlatform;
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }

  private normalizePermissionStage(stage?: IntegrationPermissionStageKey | string | null) {
    if (!stage) {
      return undefined;
    }

    const normalized = stage.toString().trim().toUpperCase();
    if (normalized === "PUBLISH" || normalized === "ENGAGEMENT" || normalized === "MESSAGING") {
      return normalized as IntegrationPermissionStageKey;
    }

    throw new Error(`Unsupported permission stage: ${stage}`);
  }

  private normalizeScopesInput(scopes?: string[] | string) {
    if (!scopes) {
      return undefined;
    }

    if (Array.isArray(scopes)) {
      return scopes.map((scope) => scope.trim()).filter(Boolean);
    }

    return scopes
      .split(/[,\n]/g)
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private resolveScopes(platform: PublishingPlatform | string, stage?: IntegrationPermissionStageKey | null) {
    const normalizedPlatform = this.normalizePlatform(platform);
    if (!normalizedPlatform) {
      throw new Error("Missing platform");
    }

    const baseScopes = PROVIDER_BASE_SCOPES[normalizedPlatform];
    if (!stage) {
      return baseScopes;
    }

    const stageDefinition = PROVIDER_PERMISSION_STAGES[normalizedPlatform].find((item) => item.key === stage);
    if (!stageDefinition) {
      return baseScopes;
    }

    return Array.from(new Set([...baseScopes, ...stageDefinition.scopes]));
  }

  private resolveProviderStatus(platform: PublishingPlatform): IntegrationProviderStatus {
    const credentialsPresent =
      platform === "FACEBOOK"
        ? Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
        : platform === "INSTAGRAM"
          ? Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
          : platform === "THREADS"
            ? Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
            : Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    return credentialsPresent ? "READY" : "NEEDS_CONFIG";
  }

  private resolveDescription(platform: PublishingPlatform) {
    switch (platform) {
      case "FACEBOOK":
        return "綁定 Facebook Page 後可做發佈與訊息接收。";
      case "INSTAGRAM":
        return "綁定 Instagram Professional 帳號後可做發佈與 DM。";
      case "THREADS":
        return "綁定 Threads 後可做內容發佈與來源追蹤。";
      case "YOUTUBE":
        return "綁定 YouTube 頻道後可做影片發佈。";
      default:
        return "平台綁定入口。";
    }
  }

  private buildAuthorizationUrl(input: {
    platform: PublishingPlatform;
    state: string;
    callbackUrl: string;
    scopes: string[];
  }) {
    const provider = PROVIDER_SOURCES[input.platform];
    if (provider === "META") {
      const { clientId } = this.getMetaConfig();
      const scope = input.scopes.join(",");
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
        input.callbackUrl
      )}&state=${encodeURIComponent(input.state)}&scope=${encodeURIComponent(scope)}&display=popup&auth_type=reauthenticate&return_scopes=true`;
    }

    if (provider === "LINE") {
      const clientId = process.env.LINE_CHANNEL_ID;
      if (!clientId) {
        throw new BadRequestException("LINE OAuth 尚未設定 LINE_CHANNEL_ID");
      }
      const scope = input.scopes.join("%20");
      return `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
        input.callbackUrl
      )}&state=${encodeURIComponent(input.state)}&scope=${scope}`;
    }

    const { clientId } = this.getGoogleConfig();
    const scope = input.scopes.join(" ");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
      input.callbackUrl
    )}&state=${encodeURIComponent(input.state)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  }

  private buildCallbackUrl(platform: PublishingPlatform) {
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3001";
    return `${baseUrl}/integrations/callback/${platform.toLowerCase()}`;
  }

  private isMockMode() {
    return (process.env.MOCK_SOCIAL_OAUTH ?? "false").toLowerCase() !== "false";
  }

  private encodeState(value: BindState) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  private decodeState(value?: string) {
    if (!value) return null;
    try {
      const json = Buffer.from(value, "base64url").toString("utf8");
      return JSON.parse(json) as BindState;
    } catch {
      return null;
    }
  }

  private createNonce() {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  private openPrivateBrowser(url: string) {
    if (process.platform === "win32") {
      const edgePaths = [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
      ];
      const chromePaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
      ];

      const edge = edgePaths.find((candidate) => existsSync(candidate));
      if (edge) {
        spawn(edge, ["--inprivate", url], {
          detached: true,
          stdio: "ignore"
        }).unref();
        return true;
      }

      const chrome = chromePaths.find((candidate) => existsSync(candidate));
      if (chrome) {
        spawn(chrome, ["--incognito", url], {
          detached: true,
          stdio: "ignore"
        }).unref();
        return true;
      }
    }

    return false;
  }

  private async upsertChannelAdapter(input: {
    workspaceId: string;
    brandId: string | null;
    platform: PublishingPlatform;
    externalAccountId: string | null;
    displayName: string;
    adapterStatus?: "ACTIVE" | "PAUSED" | "ERROR";
    config?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }) {
    const adapterType = CHANNEL_ADAPTER_MAP[input.platform];
    if (!adapterType) {
      return;
    }

    const existing = await this.prisma.channelAdapter.findFirst({
      where: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        adapterType
      },
      select: { id: true }
    });

    if (existing) {
      await this.prisma.channelAdapter.update({
        where: { id: existing.id },
        data: {
          externalAccountId: input.externalAccountId,
          provider: PROVIDER_SOURCES[input.platform],
          status: input.adapterStatus ?? "ACTIVE",
          config: input.config ?? {
            displayName: input.displayName,
            platform: input.platform
          },
          lastSyncedAt: new Date(),
          metadata: input.metadata ?? {
            connectedAt: new Date().toISOString(),
            mode: this.isMockMode() ? "MOCK" : "OAUTH"
          }
        }
      });
      return;
    }

    await this.prisma.channelAdapter.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        adapterType,
        provider: PROVIDER_SOURCES[input.platform],
        externalAccountId: input.externalAccountId,
        status: input.adapterStatus ?? "ACTIVE",
        config: input.config ?? {
          displayName: input.displayName,
          platform: input.platform
        },
        lastSyncedAt: new Date(),
        metadata: input.metadata ?? {
          connectedAt: new Date().toISOString(),
          mode: this.isMockMode() ? "MOCK" : "OAUTH"
        }
      }
    });
  }

  private async touchChannelAdapter(
    workspaceId: string | null,
    brandId: string | null,
    platform: PublishingPlatform,
    externalAccountId: string | null
  ) {
    if (!workspaceId) return;
    const adapterType = CHANNEL_ADAPTER_MAP[platform];
    if (!adapterType) return;

    const adapter = await this.prisma.channelAdapter.findFirst({
      where: {
        workspaceId,
        brandId,
        adapterType
      },
      select: { id: true }
    });

    if (adapter) {
      await this.prisma.channelAdapter.update({
        where: { id: adapter.id },
        data: {
          externalAccountId: externalAccountId ?? undefined,
          lastSyncedAt: new Date(),
          status: "ACTIVE"
        }
      });
    }
  }

  private async setChannelAdapterStatus(
    workspaceId: string,
    brandId: string | null,
    platform: PublishingPlatform,
    status: "ACTIVE" | "PAUSED" | "ERROR"
  ) {
    const adapterType = CHANNEL_ADAPTER_MAP[platform];
    if (!adapterType) return;
    const adapter = await this.prisma.channelAdapter.findFirst({
      where: {
        workspaceId,
        brandId,
        adapterType
      },
      select: { id: true }
    });
    if (adapter) {
      await this.prisma.channelAdapter.update({
        where: { id: adapter.id },
        data: { status }
      });
    }
  }

  private async toSummary(account: PlatformAccount & { token: { expiresAt: Date | null; scopes: string[]; metadata: unknown } | null }) {
    const adapterType = CHANNEL_ADAPTER_MAP[account.platform];
    const adapter = adapterType
      ? await this.prisma.channelAdapter.findFirst({
          where: {
            workspaceId: account.workspaceId ?? undefined,
            brandId: account.brandId ?? undefined,
            adapterType
          },
          orderBy: { updatedAt: "desc" }
        })
      : null;

    return {
      id: account.id,
      workspaceId: account.workspaceId ?? "",
      brandId: account.brandId ?? null,
      platform: account.platform,
      accountName: account.accountName,
      displayName: account.displayName,
      externalAccountId: account.externalAccountId,
      isActive: account.isActive,
      provider: PROVIDER_SOURCES[account.platform],
      tokenExpiresAt: account.token?.expiresAt ? account.token.expiresAt.toISOString() : null,
      tokenScopes: account.token?.scopes ?? [],
      adapterType: adapter?.adapterType ?? null,
      adapterStatus: adapter?.status ?? null,
      lastSyncedAt: adapter?.lastSyncedAt ? adapter.lastSyncedAt.toISOString() : null,
      metadata: this.extractMetadata(account.token?.metadata) ?? null
    } satisfies IntegrationAccountSummary;
  }

  private extractMetadata(metadata: unknown) {
    return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  }

  private async ensureWorkspaceContext(workspaceId: string, brandId: string | null) {
    await this.prisma.user.upsert({
      where: { email: "demo-owner@ai-vidio.local" },
      create: {
        id: "demo-owner",
        email: "demo-owner@ai-vidio.local",
        name: "Demo Owner",
        status: "ACTIVE"
      },
      update: {
        name: "Demo Owner",
        status: "ACTIVE"
      }
    });

    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      create: {
        id: workspaceId,
        ownerId: "demo-owner",
        name: workspaceId === "demo-workspace" ? "Demo Workspace" : workspaceId,
        slug: workspaceId
      },
      update: {
        name: workspaceId === "demo-workspace" ? "Demo Workspace" : workspaceId,
        status: "ACTIVE"
      }
    });

    if (brandId) {
      await this.prisma.brand.upsert({
        where: {
          workspaceId_slug: {
            workspaceId,
            slug: brandId
          }
        },
        create: {
          id: brandId,
          workspaceId,
          name: this.resolveBrandName(brandId),
          slug: brandId
        },
        update: {
          name: this.resolveBrandName(brandId),
          status: "ACTIVE"
        }
      });
    }
  }

  private resolveBrandName(brandId: string) {
    switch (brandId) {
      case "demo-brand":
        return "預設品牌";
      case "beauty-brand":
        return "美妝品牌";
      case "tech-brand":
        return "科技品牌";
      default:
        return brandId;
    }
  }

  private async upsertPlatformAccount(input: {
    workspaceId: string;
    brandId: string | null;
    platform: PublishingPlatform;
    accountName: string;
    displayName: string;
    externalAccountId: string | null;
    isActive: boolean;
    metadata: Prisma.InputJsonValue;
  }) {
    const tenantId = await this.resolveTenantIdForWorkspace(input.workspaceId);
    const existingAccount = await this.prisma.platformAccount.findFirst({
      where: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        platform: input.platform,
        externalAccountId: input.externalAccountId ?? undefined
      }
    });

    return existingAccount
      ? await this.prisma.platformAccount.update({
          where: { id: existingAccount.id },
          data: {
            tenantId: tenantId ?? undefined,
            brandId: input.brandId,
            accountName: input.accountName,
            displayName: input.displayName,
            externalAccountId: input.externalAccountId,
            isActive: input.isActive,
            metadata: input.metadata as Prisma.InputJsonValue
          }
        })
      : await this.prisma.platformAccount.create({
          data: {
            tenantId,
            workspaceId: input.workspaceId,
            brandId: input.brandId,
            platform: input.platform,
            accountName: input.accountName,
            displayName: input.displayName,
            externalAccountId: input.externalAccountId,
            isActive: input.isActive,
            metadata: input.metadata as Prisma.InputJsonValue
          }
        });
  }

  private async resolveTenantIdForWorkspace(workspaceId?: string | null) {
    if (!workspaceId) {
      return null;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { tenantId: true }
    });

    return workspace?.tenantId ?? null;
  }

  private async upsertPlatformToken(input: {
    accountId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
    metadata: Prisma.InputJsonValue;
  }) {
    await this.prisma.platformToken.upsert({
      where: { platformAccountId: input.accountId },
      create: {
        platformAccountId: input.accountId,
        accessTokenEncrypted: this.tokenEncryption.encrypt(input.accessToken),
        refreshTokenEncrypted: input.refreshToken ? this.tokenEncryption.encrypt(input.refreshToken) : null,
        tokenType: "oauth2",
        expiresAt: input.expiresAt,
        scopes: input.scopes,
        metadata: input.metadata as Prisma.InputJsonValue
      },
      update: {
        accessTokenEncrypted: this.tokenEncryption.encrypt(input.accessToken),
        refreshTokenEncrypted: input.refreshToken ? this.tokenEncryption.encrypt(input.refreshToken) : null,
        tokenType: "oauth2",
        expiresAt: input.expiresAt,
        scopes: input.scopes,
        metadata: input.metadata as Prisma.InputJsonValue
      }
    });
  }

  private async findAccountSummary(accountId: string) {
    return this.prisma.platformAccount.findUnique({
      where: { id: accountId },
      include: { token: true }
    }) as Promise<(PlatformAccount & { token: { accessTokenEncrypted: string; refreshTokenEncrypted: string | null; expiresAt: Date | null; scopes: string[]; metadata: unknown } | null }) | null>;
  }

  private getMetaConfig() {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException("Meta OAuth 尚未設定 META_APP_ID / META_APP_SECRET");
    }

    return {
      clientId,
      clientSecret,
      version: process.env.META_GRAPH_VERSION ?? "v21.0"
    };
  }

  private getGoogleConfig() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException("YouTube OAuth 尚未設定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
    }

    return {
      clientId,
      clientSecret
    };
  }

  private async exchangeMetaCodeForToken(input: {
    code: string;
    callbackUrl: string;
    config: { clientId: string; clientSecret: string; version: string };
  }) {
    const url = new URL(`https://graph.facebook.com/${input.config.version}/oauth/access_token`);
    url.searchParams.set("client_id", input.config.clientId);
    url.searchParams.set("client_secret", input.config.clientSecret);
    url.searchParams.set("redirect_uri", input.callbackUrl);
    url.searchParams.set("code", input.code);

    const response = await this.fetchJson<{ access_token: string; token_type?: string; expires_in?: number }>(url.toString());
    if (!response.access_token) {
      throw new Error("Meta access token exchange failed");
    }

    return {
      accessToken: response.access_token,
      expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000) : null
    };
  }

  private async exchangeMetaLongLivedToken(
    accessToken: string,
    config: { clientId: string; clientSecret: string; version: string }
  ) {
    const url = new URL(`https://graph.facebook.com/${config.version}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("client_secret", config.clientSecret);
    url.searchParams.set("fb_exchange_token", accessToken);

    const response = await this.fetchJson<{ access_token: string; expires_in?: number }>(url.toString());
    return {
      accessToken: response.access_token ?? accessToken,
      expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000) : null
    };
  }

  private async fetchMetaProfile(accessToken: string, config: { version: string }) {
    return this.fetchJson<{ id: string; name: string }>(
      `https://graph.facebook.com/${config.version}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
  }

  private async fetchMetaPages(
    accessToken: string,
    config: { version: string }
  ): Promise<Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }>> {
    const response = await this.fetchJson<{
      data?: Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }>;
    }>(`https://graph.facebook.com/${config.version}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(
      accessToken
    )}`);

    return response.data ?? [];
  }

  private selectMetaBinding(
    platform: PublishingPlatform,
    profile: { id: string; name: string },
    pages: Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }>,
    input: { externalAccountId?: string; displayName?: string }
  ) {
    const preferredPage = input.externalAccountId ? pages.find((page) => page.id === input.externalAccountId) : undefined;
    const fallbackPage = pages[0];
    const selectedPage = preferredPage ?? fallbackPage;

    if (platform === "FACEBOOK") {
      return {
        externalAccountId: selectedPage?.id ?? profile.id,
        displayName: input.displayName ?? selectedPage?.name ?? profile.name,
        pageId: selectedPage?.id ?? null,
        pageName: selectedPage?.name ?? null,
        instagramBusinessAccountId: selectedPage?.instagram_business_account?.id ?? null
      };
    }

    if (platform === "INSTAGRAM") {
      const instagramPage = pages.find((page) => page.instagram_business_account?.id) ?? selectedPage;
      return {
        externalAccountId: instagramPage?.instagram_business_account?.id ?? instagramPage?.id ?? profile.id,
        displayName: input.displayName ?? instagramPage?.name ?? profile.name,
        pageId: instagramPage?.id ?? null,
        pageName: instagramPage?.name ?? null,
        instagramBusinessAccountId: instagramPage?.instagram_business_account?.id ?? null
      };
    }

    return {
      externalAccountId: profile.id,
      displayName: input.displayName ?? profile.name,
      pageId: selectedPage?.id ?? null,
      pageName: selectedPage?.name ?? null,
      instagramBusinessAccountId: selectedPage?.instagram_business_account?.id ?? null
    };
  }

  private async exchangeGoogleCodeForToken(input: {
    code: string;
    callbackUrl: string;
    config: { clientId: string; clientSecret: string };
  }) {
    const response = await this.fetchJson<{
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      token_type?: string;
    }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        redirect_uri: input.callbackUrl,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!response.access_token) {
      throw new Error("Google access token exchange failed");
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000) : null
    };
  }

  private async fetchYoutubeChannel(accessToken: string) {
    const response = await this.fetchJson<{
      items?: Array<{
        id: string;
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      }>;
    }>(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      }
    );

    const channel = response.items?.[0];
    return {
      id: channel?.id ?? "youtube-channel",
      title: channel?.snippet?.title ?? null,
      thumbnailUrl: channel?.snippet?.thumbnails?.default?.url ?? null
    };
  }

  private async refreshOfficialToken(
    account: PlatformAccount & {
      token: {
        accessTokenEncrypted: string;
        refreshTokenEncrypted: string | null;
        expiresAt: Date | null;
        scopes: string[];
        metadata: unknown;
      } | null;
    }
  ) {
    const token = account.token;
    if (!token) {
      throw new Error("Platform token not found");
    }

    if (account.platform === "YOUTUBE") {
      const googleConfig = this.getGoogleConfig();
      if (!token.refreshTokenEncrypted) {
        throw new Error("YouTube refresh token not found");
      }

      const refreshToken = this.tokenEncryption.decrypt(token.refreshTokenEncrypted);
      const response = await this.fetchJson<{
        access_token: string;
        expires_in?: number;
        refresh_token?: string;
      }>("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: googleConfig.clientId,
          client_secret: googleConfig.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        }).toString()
      });

      if (!response.access_token) {
        throw new Error("Google token refresh failed");
      }

      return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token ?? refreshToken,
        expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000) : null,
        metadata: {
          ...this.extractMetadata(token.metadata),
          refreshedAt: new Date().toISOString(),
          mode: "OAUTH",
          provider: "GOOGLE"
        } as Prisma.InputJsonValue
      };
    }

    const metaConfig = this.getMetaConfig();
    const currentAccessToken = this.tokenEncryption.decrypt(token.accessTokenEncrypted);
    const response = await this.exchangeMetaLongLivedToken(currentAccessToken, metaConfig);
    return {
      accessToken: response.accessToken,
      refreshToken: null,
      expiresAt: response.expiresAt,
      metadata: {
        ...this.extractMetadata(token.metadata),
        refreshedAt: new Date().toISOString(),
        mode: "OAUTH",
        provider: "META"
      } as Prisma.InputJsonValue
    };
  }

  private async revokeOfficialToken(account: PlatformAccount & { token: { accessTokenEncrypted: string; refreshTokenEncrypted: string | null } | null }) {
    if (!account.token) {
      return;
    }

    try {
      if (account.platform === "YOUTUBE") {
        const token = this.tokenEncryption.decrypt(account.token.accessTokenEncrypted);
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ token }).toString()
        });
        return;
      }

      const metaConfig = this.getMetaConfig();
      const token = this.tokenEncryption.decrypt(account.token.accessTokenEncrypted);
      await fetch(`https://graph.facebook.com/${metaConfig.version}/me/permissions?access_token=${encodeURIComponent(token)}`, {
        method: "DELETE"
      });
    } catch {
      // Best-effort revoke only.
    }
  }

  private async syncAdapterAfterAccountChange(
    workspaceId: string | null,
    brandId: string | null,
    platform: PublishingPlatform
  ) {
    const adapterType = CHANNEL_ADAPTER_MAP[platform];
    if (!adapterType || !workspaceId) {
      return;
    }

    const remainingAccounts = await this.prisma.platformAccount.findMany({
      where: {
        workspaceId,
        brandId,
        platform,
        isActive: true
      },
      orderBy: { updatedAt: "desc" }
    });

    const adapter = await this.prisma.channelAdapter.findFirst({
      where: {
        workspaceId,
        brandId,
        adapterType
      },
      select: { id: true }
    });

    if (!adapter) {
      return;
    }

    if (remainingAccounts.length > 0) {
      await this.prisma.channelAdapter.update({
        where: { id: adapter.id },
        data: {
          externalAccountId: remainingAccounts[0]?.externalAccountId ?? null,
          status: "ACTIVE",
          lastSyncedAt: new Date(),
          metadata: {
            syncedFrom: "account-change",
            updatedAt: new Date().toISOString()
          } as Prisma.InputJsonValue
        }
      });
      return;
    }

    await this.prisma.channelAdapter.update({
      where: { id: adapter.id },
      data: {
        externalAccountId: null,
        status: "PAUSED",
        lastSyncedAt: new Date(),
        metadata: {
          syncedFrom: "account-change",
          updatedAt: new Date().toISOString()
        } as Prisma.InputJsonValue
      }
    });
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(body || `Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
