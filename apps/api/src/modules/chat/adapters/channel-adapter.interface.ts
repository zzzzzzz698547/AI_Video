export interface ChannelAdapterContract {
  readonly channel: string;
  connectAccount(input: { workspaceId: string; brandId?: string; accountId: string }): Promise<void>;
  refreshToken(input: { workspaceId: string; brandId?: string; accountId: string }): Promise<void>;
  validateWebhook(payload: unknown): boolean;
  sendMessage(input: { workspaceId: string; brandId?: string; threadId: string; message: string }): Promise<{ externalMessageId: string }>;
}

