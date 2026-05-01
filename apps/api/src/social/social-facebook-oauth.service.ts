import { BadRequestException, Injectable } from "@nestjs/common";
import { SocialPlatform } from "@prisma/client";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { SocialService } from "./social.service";

type FacebookOAuthState = {
  tenantId: string;
  ts: number;
  nonce: string;
};

@Injectable()
export class SocialFacebookOAuthService {
  private readonly graphVersion = "v19.0";

  constructor(
    private readonly tenancyService: TenancyService,
    private readonly socialService: SocialService
  ) {}

  async buildLoginUrl(tenantId: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    const config = this.getConfig();
    const state = this.encodeState({
      tenantId,
      ts: Date.now(),
      nonce: Math.random().toString(36).slice(2)
    });
    const url = new URL(`https://www.facebook.com/${this.graphVersion}/dialog/oauth`);
    url.searchParams.set("client_id", config.appId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set(
      "scope",
      [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish"
      ].join(",")
    );
    url.searchParams.set("display", "popup");
    url.searchParams.set("auth_type", "reauthenticate");
    url.searchParams.set("return_scopes", "true");
    return { authUrl: url.toString(), state };
  }

  async handleCallback(code?: string, stateParam?: string) {
    if (!code) {
      throw new BadRequestException("Missing Facebook OAuth code");
    }

    const state = this.decodeState(stateParam);
    if (!state?.tenantId) {
      throw new BadRequestException("Missing tenantId in OAuth state");
    }

    await this.tenancyService.assertTenantAccess(state.tenantId);

    const config = this.getConfig();
    const token = await this.exchangeCodeForToken(code, config);
    const pages = await this.fetchPages(token.access_token);

    if (pages.length === 0) {
      throw new BadRequestException("Facebook OAuth 成功，但沒有讀到任何可管理的 Page");
    }

    await this.socialService.syncMetaAdapters({
      tenantId: state.tenantId,
      pages,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish"
      ],
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null
    });

    return {
      tenantId: state.tenantId,
      userAccessTokenSuccess: Boolean(token.access_token),
      userAccessTokenPreview: this.mask(token.access_token),
      pages: pages.map((page) => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessTokenPreview: page.access_token ? this.mask(page.access_token) : null,
        instagramBusinessAccountId: page.instagram_business_account?.id ?? null
      }))
    };
  }

  private getConfig() {
    const appId = process.env.FB_APP_ID?.trim();
    const appSecret = process.env.FB_APP_SECRET?.trim();
    const redirectUri = process.env.FB_REDIRECT_URI?.trim() || "http://localhost:3001/auth/facebook/callback";

    if (!appId || !appSecret) {
      throw new BadRequestException("FB_APP_ID / FB_APP_SECRET 尚未設定");
    }

    return { appId, appSecret, redirectUri };
  }

  private async exchangeCodeForToken(code: string, config: { appId: string; appSecret: string; redirectUri: string }) {
    const url = new URL(`https://graph.facebook.com/${this.graphVersion}/oauth/access_token`);
    url.searchParams.set("client_id", config.appId);
    url.searchParams.set("client_secret", config.appSecret);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("code", code);
    return this.fetchJson<{ access_token: string; token_type: string; expires_in?: number }>(url.toString());
  }

  private async fetchPages(accessToken: string) {
    return this.fetchJson<{
      data?: Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } | null }>;
    }>(
      `https://graph.facebook.com/${this.graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
    ).then((response) => response.data ?? []);
  }

  private encodeState(state: FacebookOAuthState) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  }

  private decodeState(state?: string) {
    if (!state) {
      return null;
    }

    try {
      return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as FacebookOAuthState;
    } catch {
      throw new BadRequestException("Invalid OAuth state");
    }
  }

  private mask(token: string) {
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const raw = await response.text();
    if (!response.ok) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        throw new Error(parsed.error?.message ?? raw);
      } catch (error) {
        if (error instanceof Error && error.message !== raw) {
          throw error;
        }
        throw new Error(raw || `HTTP ${response.status}`);
      }
    }

    return JSON.parse(raw) as T;
  }
}
