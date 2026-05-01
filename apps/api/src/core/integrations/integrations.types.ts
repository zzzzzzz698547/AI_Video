import type { PublishingPlatform } from "@prisma/client";

export type IntegrationMode = "MOCK" | "OAUTH" | "MANUAL";

export type IntegrationProviderStatus = "READY" | "NEEDS_CONFIG";

export type IntegrationPermissionStageKey = "PUBLISH" | "ENGAGEMENT" | "MESSAGING";

export type IntegrationPermissionStage = {
  key: IntegrationPermissionStageKey;
  label: string;
  description: string;
  scopes: string[];
  supported: boolean;
};

export type IntegrationProviderDefinition = {
  platform: PublishingPlatform;
  label: string;
  provider: "META" | "LINE" | "GOOGLE";
  description: string;
  callbackPath: string;
  scopes: string[];
  permissionStages: IntegrationPermissionStage[];
  status: IntegrationProviderStatus;
  mode: IntegrationMode;
};

export type IntegrationAccountSummary = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  platform: PublishingPlatform;
  accountName: string;
  displayName: string | null;
  externalAccountId: string | null;
  isActive: boolean;
  provider: string;
  tokenExpiresAt: string | null;
  tokenScopes: string[];
  adapterType: string | null;
  adapterStatus: string | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type ConnectIntegrationInput = {
  workspaceId: string;
  brandId?: string;
  platform: PublishingPlatform | string;
  accountName?: string;
  permissionStage?: IntegrationPermissionStageKey | string;
};

export type CallbackIntegrationInput = {
  platform: PublishingPlatform | string;
  code: string;
  state?: string;
  externalAccountId?: string;
  displayName?: string;
};

export type ManualBindIntegrationInput = {
  workspaceId: string;
  brandId?: string;
  platform: PublishingPlatform | string;
  accountName: string;
  displayName?: string;
  externalAccountId?: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes?: string[] | string;
  adapterStatus?: "ACTIVE" | "PAUSED";
  metadata?: Record<string, unknown>;
};

export type ConnectIntegrationResult = {
  platform: PublishingPlatform;
  mode: IntegrationMode;
  provider: string;
  authUrl: string;
  callbackUrl: string;
  scopes: string[];
  state: string;
  redirectUri: string;
  permissionStage: IntegrationPermissionStageKey | "BASE";
};
