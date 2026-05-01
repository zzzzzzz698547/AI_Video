# AI-VIDIO Core Stack

這個 workspace 目前已經拆成可獨立開發的 SaaS 骨架：

- `apps/api`: NestJS + Prisma + PostgreSQL 的後端
- `apps/web`: 前台內容 / 影片 / 發布工作台
- `apps/admin-dashboard`: 後台營運工作台
- `packages/types`: 共用型別與 API 契約
- `packages/config`: 共用設定
- `packages/ui`: 共用 UI 元件
- `packages/utils`: 共用工具

## 第六模組：AI 客服成交助手

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

## 社群綁定

如果你要先綁定社群帳號，請先開：

- `http://localhost:3002/integrations`

這個頁面會先用 mock OAuth 跑完整流程，後續再切成正式官方授權。

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

### 資料表

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

## 開發流程

1. `npm run prisma:generate`
2. `npm run build:api`
3. `npm run build:admin`
4. `npm run build:web`

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

## 環境變數

請先參考 `.env.example`。
