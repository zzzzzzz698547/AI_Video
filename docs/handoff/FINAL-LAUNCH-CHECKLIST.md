# AI-VIDIO 最終上線檢查表

這份文件給正式切換、重新部署、交付驗收前使用。  
目標是用最少的步驟確認系統真的處於可使用狀態。

---

## 1. 正式環境檢查

### 1.1 網址確認
- Web：[https://ai-vidio-web.vercel.app](https://ai-vidio-web.vercel.app)
- Admin：[https://ai-vidio-admin.vercel.app](https://ai-vidio-admin.vercel.app)
- API：[https://ai-vidio-api-production.up.railway.app](https://ai-vidio-api-production.up.railway.app)
- Health：[https://ai-vidio-api-production.up.railway.app/health](https://ai-vidio-api-production.up.railway.app/health)

### 1.2 基礎回應
- [ ] Web `/login` 可正常開啟
- [ ] Admin `/login` 可正常開啟
- [ ] API `/health` 回 `200`

---

## 2. Railway 檢查

### 2.1 核心變數
- [ ] `DATABASE_URL`
- [ ] `TOKEN_ENCRYPTION_KEY`
- [ ] `APP_BASE_URL`
- [ ] `WEB_BASE_URL`
- [ ] `NEXT_PUBLIC_WEB_BASE_URL`
- [ ] `CORS_ORIGIN`

### 2.2 管理員登入
- [ ] `ADMIN_LOGIN_USERNAME`
- [ ] `ADMIN_LOGIN_PASSWORD`
- [ ] `ADMIN_LOGIN_DISPLAY_NAME`

### 2.3 第三方平台
- [ ] `FB_APP_ID`
- [ ] `FB_APP_SECRET`
- [ ] `FB_REDIRECT_URI`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `OPENAI_API_KEY`
- [ ] `GEMINI_API_KEY`

### 2.4 部署狀態
- [ ] Railway 最新部署為 Active
- [ ] 最新部署已吃到最新環境變數

---

## 3. Vercel 檢查

### 3.1 Web
- [ ] `NEXT_PUBLIC_API_BASE_URL`
- [ ] `NEXT_PUBLIC_ADMIN_BASE_URL`

### 3.2 Admin
- [ ] `NEXT_PUBLIC_API_BASE_URL`
- [ ] `NEXT_PUBLIC_ADMIN_BASE_URL`

### 3.3 部署狀態
- [ ] Web 已完成最新部署
- [ ] Admin 已完成最新部署

---

## 4. OAuth / 第三方設定檢查

### 4.1 Meta / Facebook Login
- [ ] `Client OAuth Login = Yes`
- [ ] `Web OAuth Login = Yes`
- [ ] `Valid OAuth Redirect URIs` 已更新為正式網址

### 4.2 Google OAuth
- [ ] YouTube redirect URI 已更新為正式網址

---

## 5. SaaS / 授權檢查

- [ ] 管理員可正常登入
- [ ] Tenant 可正常進入授權中心
- [ ] 過期授權會導到過期 / 續費頁
- [ ] 核心 API 有做授權檢查

---

## 6. 功能驗收檢查

### 6.1 前台
- [ ] `/license-center`
- [ ] `/url-analysis`
- [ ] `/video-studio`
- [ ] `/publishing-center`

### 6.2 後台
- [ ] `/integrations`
- [ ] 手動綁定畫面正常
- [ ] 教學卡正常顯示

### 6.3 API
- [ ] `/health`
- [ ] 管理員登入 API
- [ ] 授權碼啟用 API

---

## 7. 發布前最後確認

- [ ] 測一次 URL 驗證與分析
- [ ] 測一次 Video Studio AI 綁定區
- [ ] 測一次社群綁定頁
- [ ] 測一次發布中心建立任務
- [ ] 確認正式站 UI 已吃到最新版本

---

## 8. 備註

- 若正式站功能不通，先查 Railway API 與環境變數，再查第三方平台 callback。
- 若登入或 callback 異常，優先檢查最新 redeploy 是否真的完成。
