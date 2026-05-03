# AI-VIDIO 正式交付清單

## 1. 專案資訊
- 專案名稱：AI-VIDIO
- 專案型態：SaaS 多租戶 AI 影片生成與社群發布系統
- 交付內容：前台、後台、API、授權碼流程、AI 影片工作流、社群綁定與發布流程

## 2. 正式環境網址
- Web：[https://ai-vidio-web.vercel.app](https://ai-vidio-web.vercel.app)
- Admin：[https://ai-vidio-admin.vercel.app](https://ai-vidio-admin.vercel.app)
- API：[https://ai-vidio-api-production.up.railway.app](https://ai-vidio-api-production.up.railway.app)
- Health Check：[https://ai-vidio-api-production.up.railway.app/health](https://ai-vidio-api-production.up.railway.app/health)

## 3. 已交付核心功能
### 3.1 帳號與授權
- 管理員帳密登入
- SaaS 授權碼啟用流程
- 多租戶 Tenant / TenantUser / LicenseKey 結構
- 授權狀態檢查與過期限制

### 3.2 AI 內容工作流
- URL 驗證與來源預覽
- URL 分析與 AI 分段進度條
- Video Studio 影片生成工作台
- OpenAI / Gemini 綁定、模型切換、啟用切換

### 3.3 社群整合
- Facebook / Instagram / Threads / YouTube 綁定中心
- 手動綁定流程
- OAuth 綁定骨架與 callback 流程
- 發布中心與發布紀錄查詢

## 4. 已完成部署
- Web 部署到 Vercel
- Admin 部署到 Vercel
- API 部署到 Railway
- PostgreSQL 掛載到 Railway API

## 5. 已完成 UI / UX 收尾
- 前後台亮色主題
- 前後台手機漢堡選單
- login / license-center 手機板一致化
- url-analysis / video-studio / publishing-center / integrations 手機板密度優化
- 前後台共用 spacing / 字級 / badge / button / table 密度統一

## 6. 上線前複查項目
### 6.1 Railway
- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_LOGIN_DISPLAY_NAME`
- `CORS_ORIGIN`
- `APP_BASE_URL`
- `WEB_BASE_URL`

### 6.2 第三方平台
- Meta `Valid OAuth Redirect URIs`
- Google OAuth redirect URI
- OpenAI API Key
- Gemini API Key

## 7. 驗收路徑
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

## 8. 備註
- 正式登入、授權、AI 綁定與社群綁定都依賴外部環境變數與第三方平台設定
- 若正式站出現登入或 callback 問題，請先優先檢查 Railway / Meta / Google 環境變數
