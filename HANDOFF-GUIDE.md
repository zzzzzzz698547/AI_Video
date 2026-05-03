# AI-VIDIO Handoff Guide

## 1. 專案定位

AI-VIDIO 是一套多租戶 SaaS 內容工作台，主軸是：

- AI 影片生成
- URL 分析與腳本拆解
- 社群帳號綁定
- 社群發布與發布紀錄
- 授權碼與租戶控管
- 管理員後台維運

目前正式環境已拆成：

- Web：Vercel
- Admin：Vercel
- API：Railway
- Database：Railway PostgreSQL

## 2. 正式環境

### 2.1 正式網址

- Web：[https://ai-vidio-web.vercel.app](https://ai-vidio-web.vercel.app)
- Admin：[https://ai-vidio-admin.vercel.app](https://ai-vidio-admin.vercel.app)
- API：[https://ai-vidio-api-production.up.railway.app](https://ai-vidio-api-production.up.railway.app)
- Health：[https://ai-vidio-api-production.up.railway.app/health](https://ai-vidio-api-production.up.railway.app/health)

### 2.2 Git 倉庫

- GitHub：[https://github.com/zzzzzzz698547/AI_Video](https://github.com/zzzzzzz698547/AI_Video)
- 分支：`main`

## 3. 專案架構

### 3.1 前台

- 路徑：`apps/web`
- 框架：Next.js App Router
- 主要頁面：
  - `/login`
  - `/license-center`
  - `/url-analysis`
  - `/video-studio`
  - `/publishing-center`

### 3.2 後台

- 路徑：`apps/admin-dashboard`
- 框架：Next.js App Router
- 主要頁面：
  - `/login`
  - `/integrations`
  - `/analytics`
  - `/funnel-center`

### 3.3 API

- 路徑：`apps/api`
- 框架：NestJS
- ORM：Prisma
- DB：PostgreSQL

## 4. 已完成主流程

### 4.1 SaaS 授權

- LicenseKey 啟用
- Tenant 建立
- TenantUser 綁定
- 授權過期限制
- 過期後導向授權中心 / 續費頁

### 4.2 AI 工作流

- URL 驗證
- URL 分析
- AI 分段進度條
- Video Studio 模型切換
- OpenAI / Gemini 綁定

### 4.3 社群工作流

- 社群 OAuth 骨架
- 手動綁定
- Adapter 與 Publish Job 資料流
- 發布中心與發布紀錄

## 5. 管理員登入

### 5.1 正式站入口

- Web login：[https://ai-vidio-web.vercel.app/login](https://ai-vidio-web.vercel.app/login)
- Admin login：[https://ai-vidio-admin.vercel.app/login](https://ai-vidio-admin.vercel.app/login)

### 5.2 Railway 變數

正式站管理員登入依賴這三個變數：

- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_LOGIN_DISPLAY_NAME`

如果正式登入失敗，先檢查：

1. 變數值是否正確
2. 前後是否有空白
3. 存檔後是否有重新部署

## 6. 必要環境變數

### 6.1 Railway API

至少要有：

- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `WEB_BASE_URL`
- `NEXT_PUBLIC_WEB_BASE_URL`
- `CORS_ORIGIN`
- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_LOGIN_DISPLAY_NAME`
- `FB_APP_ID`
- `FB_APP_SECRET`
- `FB_REDIRECT_URI`
- `META_APP_ID`
- `META_APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

### 6.2 Vercel Web

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_BASE_URL`

### 6.3 Vercel Admin

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_BASE_URL`

## 7. 第三方平台設定

### 7.1 Meta / Facebook Login

至少要確認：

- `Client OAuth Login = Yes`
- `Web OAuth Login = Yes`
- `Valid OAuth Redirect URIs` 正確

目前正式 callback 應對到：

- `https://ai-vidio-api-production.up.railway.app/auth/facebook/callback`
- `https://ai-vidio-api-production.up.railway.app/integrations/callback/facebook`
- `https://ai-vidio-api-production.up.railway.app/integrations/callback/instagram`
- `https://ai-vidio-api-production.up.railway.app/integrations/callback/threads`

### 7.2 Google OAuth

正式 callback：

- `https://ai-vidio-api-production.up.railway.app/integrations/callback/youtube`

## 8. 常用驗收路徑

### 前台

- `/login`
- `/license-center`
- `/url-analysis`
- `/video-studio`
- `/publishing-center`

### 後台

- `/login`
- `/integrations`

### API

- `/health`

## 9. 常見問題排查

### 9.1 Railway 正常，但登入失敗

優先檢查：

- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- 是否 redeploy

### 9.2 Vercel 頁面正常，但 API 呼叫失敗

優先檢查：

- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGIN`
- Railway API 是否存活

### 9.3 社群 OAuth 無法 callback

優先檢查：

- Meta / Google redirect URI
- `APP_BASE_URL`
- `FB_REDIRECT_URI`

### 9.4 AI 綁定有畫面，但無法生成

優先檢查：

- OpenAI / Gemini API Key
- 目前 provider 是否啟用
- tenant 授權是否過期

## 10. 維護建議

- 每次改正式環境變數後都手動確認 Railway redeploy
- 每次推版後先驗 `/health`
- 先驗登入，再驗 URL 分析，再驗影片工作台，再驗後台綁定
- 若要正式移交，建議把帳密與第三方 API key 轉到受控密碼管理器
