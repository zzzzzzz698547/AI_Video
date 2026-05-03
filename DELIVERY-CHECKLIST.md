# AI-VIDIO 交付清單

## 正式網址
- Web: https://ai-vidio-web.vercel.app
- Admin: https://ai-vidio-admin.vercel.app
- API: https://ai-vidio-api-production.up.railway.app

## 已完成主流程
- 管理員帳密登入
- SaaS 授權碼啟用與租戶流程
- URL 驗證、分析與 AI 分段進度
- Video Studio AI 綁定與模型切換
- 社群手動綁定與 OAuth 綁定骨架
- Facebook / Instagram / Threads / YouTube 整合頁
- 影片發布中心與發布紀錄

## 已完成部署
- Web 部署到 Vercel
- Admin 部署到 Vercel
- API 部署到 Railway
- PostgreSQL 掛載到 Railway API

## 已完成 UI 收邊
- 前後台亮色主題
- 手機漢堡選單
- login / license-center 手機板一致化
- url-analysis / video-studio / publishing-center / integrations 手機板密度優化
- 前後台共用 spacing / 字級 / badge / button 密度統一

## 上線前建議複查
- Railway `ADMIN_LOGIN_USERNAME`
- Railway `ADMIN_LOGIN_PASSWORD`
- Railway `TOKEN_ENCRYPTION_KEY`
- Meta `Valid OAuth Redirect URIs`
- Google OAuth redirect URI
- OpenAI / Gemini API Keys
- CORS_ORIGIN 是否包含正式前後台網域

## 驗收建議
- Web `/login`
- Web `/url-analysis`
- Web `/video-studio`
- Web `/publishing-center`
- Admin `/login`
- Admin `/integrations`
- API `/health`
