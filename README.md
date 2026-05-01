# AI-VIDIO Core Stack

AI-VIDIO 目前是一個以多租戶 SaaS 為核心的 AI 影片與社群發布工作台。

這個 workspace 已經拆成可獨立開發的完整骨架：

- `apps/api`: NestJS + Prisma + PostgreSQL 的後端
- `apps/web`: 前台內容 / 影片 / 發布工作台
- `apps/admin-dashboard`: 後台營運工作台
- `packages/types`: 共用型別與 API 契約
- `packages/config`: 共用設定
- `packages/ui`: 共用 UI 元件
- `packages/utils`: 共用工具

## 目前主流程

目前系統已經串成這幾條主線：

1. `授權碼啟用 -> Tenant 建立 -> 進入系統`
2. `貼網址 -> AI 分析 -> 送進影片生成`
3. `內容生成 / 影片生成 -> 發布中心 -> 社群發布`
4. `社群 OAuth / 手動綁定 -> Tenant 底下管理帳號`

如果你是第一次打開專案，最建議的入口順序：

1. `http://localhost:3000/license-center`
2. `http://localhost:3000/url-analysis`
3. `http://localhost:3000/video-studio`
4. `http://localhost:3000/publishing-center`
5. `http://localhost:3002/integrations`

## GitHub 倉庫

- Repository: [https://github.com/zzzzzzz698547/AI_Video](https://github.com/zzzzzzz698547/AI_Video)
- Default branch: `main`

目前 Git 倉庫已經做過一次清理：

- `.tools/` 不再納入版控
- `apps/api/storage/` 影片輸出檔不再納入版控
- 之後如果需要分享本機工具，建議寫進文件，不要直接提交二進位檔

## 主要模組：AI 客服成交助手

這個模組負責：

- 自動回覆
- 意圖分類
- lead 評分
- 知識庫檢索
- 商品推薦
- 成交引導
- 轉人工接手
- 自動 follow-up

### 主要後端模組

- `apps/api/src/modules/chat/chat.module.ts`
- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/api/src/modules/chat/chat.service.ts`
- `apps/api/src/modules/chat/chat-orchestrator.service.ts`
- `apps/api/src/modules/chat/conversation.service.ts`
- `apps/api/src/modules/chat/intent-classifier.service.ts`
- `apps/api/src/modules/chat/lead-scoring.service.ts`
- `apps/api/src/modules/chat/knowledge-retrieval.service.ts`
- `apps/api/src/modules/chat/sales-assistant.service.ts`
- `apps/api/src/modules/chat/handoff.service.ts`
- `apps/api/src/modules/chat/follow-up-assistant.service.ts`
- `apps/api/src/modules/chat/comment-lead.service.ts`

### API

- `POST /chat/message`
- `GET /chat/conversations`
- `GET /chat/conversation/:id`
- `POST /chat/handoff/:id`
- `POST /knowledge-base`
- `GET /knowledge-base`
- `POST /comment-lead`
- `POST /follow-up/run`

## SaaS 授權與多租戶

目前專案已經有 SaaS 多租戶骨架：

- `Tenant`
- `TenantUser`
- `LicenseKey`
- Tenant session gate
- 授權到期檢查
- 後端核心 API 授權限制

目前支援：

- 授權碼格式：`JX-XXXX-XXXX-XXXX`
- 啟用授權碼後自動建立 Tenant
- TenantUser 綁定
- 授權到期後限制核心功能
- 前端授權中心 / 過期頁 / 續費頁

注意：

- 目前已經有「授權碼 + tenant session」流程
- 但完整的 Email / Password / JWT Auth 仍建議列為下一階段

## 社群綁定

如果你要先綁定社群帳號，請先開：

- `http://localhost:3002/integrations`

這個頁面目前支援：

- Facebook / Instagram / Threads / YouTube OAuth 綁定
- 手動綁定
- 多租戶 tenant 綁定資料
- 綁定後同步寫入資料庫
- 綁定後可接社群發布任務

目前社群綁定是**真實流程**：

- OAuth 走 Meta / Google 官方授權
- 手動綁定會先驗證 token 再寫入資料庫
- 綁定資料會跟 tenant 關聯

### 重要環境變數

- `NEXT_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `MOCK_SOCIAL_OAUTH`
- `TOKEN_ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_IMAGE_MODEL`
- `META_APP_ID`
- `META_APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 影片生成模式

`/video-studio` 現在支援三種素材模式：

- `REAL_MEDIA`
  - 優先抓取 Wikimedia Commons 的真實素材
- `AI_IMAGE`
  - 優先使用 OpenAI 生成直式圖片
- `HYBRID`
  - 交錯使用真實素材與 AI 影像

如果沒有設定 `OPENAI_API_KEY`，`AI_IMAGE` 與 `HYBRID` 仍會自動降級成可用的真實素材來源，所以本機依然可以先正常生成影片。

### AI API 綁定

在 `/video-studio` 裡可以直接綁定 AI 影像 API：

- OpenAI
- Gemini

綁定後會優先使用資料庫內的 API Key，沒有綁定時才會讀 `.env` 的 fallback。

### 主要資料表

已補入核心 schema：

- `conversations`
- `conversation_messages`
- `customer_profiles`
- `customer_tags`
- `lead_scores`
- `intent_predictions`
- `ai_reply_logs`
- `knowledge_base_articles`
- `faq_items`
- `handoff_logs`
- `follow_up_rules`
- `follow_up_jobs`
- `comment_leads`
- `channel_adapters`
- `escalation_rules`
- `tenants`
- `tenant_users`
- `license_keys`
- `social_adapters`
- `social_publish_jobs`

## 開發流程

1. `npm run prisma:generate`
2. `npm run build:api`
3. `npm run build:admin`
4. `npm run build:web`

如果要完整檢查：

```powershell
npm run prisma:generate
npm run build
```

如果只想快速確認目前這版能不能過：

```powershell
npm run prisma:generate
npm run build:api
npm run build:web
npm run build:admin
```

## 一鍵啟動

如果你想直接看整個系統的樣子，可以：

1. 直接雙擊根目錄的 `start-all.bat`
2. 或在 PowerShell 執行：

```powershell
npm run dev:all
```

它會：

1. 先嘗試啟動 `PostgreSQL` 和 `Redis`
2. 自動補上本機開發需要的預設環境變數
3. 開啟三個服務：
   - API: `http://localhost:3001`
   - Web: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3002`
4. 自動執行 Prisma schema push，讓本機資料表先建立起來

如果你已經有自己的 `.env`，腳本會優先使用你的設定。

如果你是 Windows，本機最常用的是：

```powershell
start-all.bat
```

或：

```powershell
npm run dev:all
```

## 環境變數

請先參考 `.env.example`。

至少建議先確認這些：

- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `REDIS_URL`

## 啟動後入口

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)
- Admin Dashboard: [http://localhost:3002](http://localhost:3002)

常用頁面：

- URL 分析：`http://localhost:3000/url-analysis`
- Video Studio：`http://localhost:3000/video-studio`
- Publishing Center：`http://localhost:3000/publishing-center`
- 社群綁定中心：`http://localhost:3002/integrations`
- 授權中心：`http://localhost:3000/license-center`
- 授權過期頁：`http://localhost:3000/license-expired`
- 續費頁：`http://localhost:3000/renewal`

## GitHub Actions CI

目前倉庫已經有 GitHub Actions：

- Workflow: `.github/workflows/ci.yml`

目前 CI 會在：

- push 到 `main`
- pull request

時自動執行：

1. `npm ci`
2. `npm run prisma:generate`
3. `npm run build`

如果 CI 失敗，通常先檢查：

- Prisma schema 是否有更新但未 generate
- `.env.example` 是否缺少新欄位
- Web / Admin 的型別錯誤
- API 新增模組後是否忘記註冊到 module

## 版本控管備註

目前 Git 倉庫已整理成較適合長期協作的狀態：

- `.tools/` 不再提交
- `apps/api/storage/` 輸出檔不再提交
- Redis 安裝包、影片產出檔、暫存檔不再進版控

目前遠端倉庫：

- [AI_Video](https://github.com/zzzzzzz698547/AI_Video)

## Render 部署 API

目前這個 monorepo 已經附上根目錄的 [render.yaml](C:/Users/user/Desktop/AI-VIDIO/render.yaml)，可以直接讓 Render 從 GitHub 匯入 Blueprint。

### 建議部署方式

- `apps/web`：維持部署在 Vercel
- `apps/admin-dashboard`：維持部署在 Vercel
- `apps/api`：部署到 Render
- PostgreSQL：直接使用 Render Managed Postgres

### 匯入步驟

1. 先把目前專案推到 GitHub `main`
2. 在 Render 後台選 `New +`
3. 選 `Blueprint`
4. 連接 GitHub 倉庫：
   - [AI_Video](https://github.com/zzzzzzz698547/AI_Video)
5. Render 會自動讀取根目錄的 `render.yaml`
6. 確認會建立：
   - `ai-vidio-api` Web Service
   - `ai-vidio-db` Postgres Database
7. 建立完成後，到 `ai-vidio-api` 的 Environment 補齊敏感變數

### Render 需要手動補的環境變數

以下欄位在 Blueprint 內保留成手動填寫：

- `NEXT_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `FB_APP_ID`
- `FB_APP_SECRET`
- `FB_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_DM_ACCESS_TOKEN`

### Render 建立完成後要這樣回填

假設 Render API 網址是：

```txt
https://ai-vidio-api.onrender.com
```

請至少補這幾個：

```txt
NEXT_PUBLIC_API_BASE_URL=https://ai-vidio-api.onrender.com
APP_BASE_URL=https://ai-vidio-api.onrender.com
FB_REDIRECT_URI=https://ai-vidio-api.onrender.com/auth/facebook/callback
```

如果前端仍在 Vercel，建議同步確認：

```txt
CORS_ORIGIN=https://ai-vidio-web.vercel.app,https://ai-vidio-admin.vercel.app,http://localhost:3000,http://localhost:3002
WEB_BASE_URL=https://ai-vidio-web.vercel.app
NEXT_PUBLIC_WEB_BASE_URL=https://ai-vidio-web.vercel.app
```

### Vercel 也要同步更新

前端部署到 Vercel 後，請把 Vercel 專案內的：

```txt
NEXT_PUBLIC_API_BASE_URL
```

改成你的 Render API 網址，否則前台仍會打回本機或舊的 tunnel。

### 部署後驗證

請先確認：

1. `https://your-render-api/health` 可回應
2. Web 與 Admin 的前端環境變數已指向 Render API
3. Meta / Google OAuth Console 的 callback 已改成 Render 正式網址
4. `db:push` 在 Render 首次部署有成功執行

### 注意

- `render.yaml` 目前只部署 API 與資料庫，不會替你部署兩個 Next.js 前端
- Redis 在這個專案是選配；沒填 `REDIS_URL` 時會自動走 fallback，不會阻止 API 啟動
- 如果你之後改了 Render 服務網址，記得同步更新：
  - Vercel `NEXT_PUBLIC_API_BASE_URL`
  - `APP_BASE_URL`
  - `FB_REDIRECT_URI`
  - Meta / Google OAuth callback

## 部署前提醒

如果要從本機開發走到正式部署，建議至少先完成這些：

1. 把 `.env` 內正式金鑰補齊
2. 把 `localhost` callback 改成正式 HTTPS 網域
3. 確認 Meta / Google OAuth console 都已更新 callback
4. 補正式的隱私政策與資料刪除頁
5. 確認 PostgreSQL / Redis 是正式服務，不是本機臨時環境
6. 將資料刪除 callback / instructions 改成固定正式網域
7. 補正式 Auth 流程與後端 TenantUser 權限控管

## 下一階段建議

如果你要把這套系統推到更完整的正式版，最自然的下一步是：

1. 補真正的 Email / Password / JWT Auth
2. 完成 TenantUser role-based 權限控管
3. 把社群發布、影片生成、授權中心做成完整客戶工作流
