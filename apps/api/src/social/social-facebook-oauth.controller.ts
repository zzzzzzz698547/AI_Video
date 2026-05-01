import { Controller, Get, Query, Res } from "@nestjs/common";
import { SocialFacebookOAuthService } from "./social-facebook-oauth.service";

@Controller("auth/facebook")
export class SocialFacebookOAuthController {
  constructor(private readonly facebookOAuth: SocialFacebookOAuthService) {}

  @Get("login")
  async login(@Query("tenantId") tenantId: string, @Res() res: any) {
    const { authUrl } = await this.facebookOAuth.buildLoginUrl(tenantId);
    return res.redirect(authUrl);
  }

  @Get("callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Res() res: any) {
    try {
      const result = await this.facebookOAuth.handleCallback(code, state);
      const rows = result.pages
        .map(
          (page) => `
            <tr>
              <td>${page.pageId}</td>
              <td>${page.pageName}</td>
              <td>${page.pageAccessTokenPreview ?? "-"}</td>
              <td>${page.instagramBusinessAccountId ?? "-"}</td>
            </tr>
          `
        )
        .join("");

      return res
        .status(200)
        .send(`<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>Facebook OAuth Callback</title>
    <style>
      body { font-family: Arial, sans-serif; background: #09101f; color: #eef4ff; padding: 32px; }
      .card { max-width: 960px; margin: 0 auto; background: #101a2d; border: 1px solid #203456; border-radius: 16px; padding: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { padding: 12px; border-bottom: 1px solid #243857; text-align: left; }
      .ok { color: #66e1a6; }
      code { background: #08101d; padding: 2px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Facebook OAuth 綁定完成</h1>
      <p class="ok">user access token：${result.userAccessTokenSuccess ? "成功" : "失敗"}</p>
      <p>tenantId：<code>${result.tenantId}</code></p>
      <p>user access token preview：<code>${result.userAccessTokenPreview}</code></p>
      <table>
        <thead>
          <tr>
            <th>page id</th>
            <th>page name</th>
            <th>page access token</th>
            <th>instagram id</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </body>
</html>`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Facebook OAuth callback failed";
      return res.status(400).send(`<!doctype html><html><body><h1>Facebook OAuth 失敗</h1><pre>${message}</pre></body></html>`);
    }
  }
}
