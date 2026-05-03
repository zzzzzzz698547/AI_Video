# AI-VIDIO 營運 SOP

## 1. 文件用途

這份文件給內部營運、維運、交接人員使用。  
目標是讓接手的人可以快速確認：

- 正式站是否正常
- API 是否正常
- 管理員登入是否正常
- 租戶授權是否正常
- AI 分析 / 影片 / 發布流程是否正常
- 社群綁定是否正常

## 2. 正式環境入口

- Web：[https://ai-vidio-web.vercel.app](https://ai-vidio-web.vercel.app)
- Admin：[https://ai-vidio-admin.vercel.app](https://ai-vidio-admin.vercel.app)
- API：[https://ai-vidio-api-production.up.railway.app](https://ai-vidio-api-production.up.railway.app)
- Health：[https://ai-vidio-api-production.up.railway.app/health](https://ai-vidio-api-production.up.railway.app/health)

## 3. 每日檢查 SOP

### 3.1 基礎存活檢查

先確認：

1. API `/health` 正常回應
2. Web `/login` 可打開
3. Admin `/login` 可打開

建議檢查路徑：

- Web `/login`
- Web `/url-analysis`
- Web `/video-studio`
- Web `/publishing-center`
- Admin `/login`
- Admin `/integrations`
- API `/health`

### 3.2 管理員登入檢查

檢查項目：

1. 管理員是否可登入 Web
2. 管理員是否可登入 Admin
3. 登入後是否顯示管理員模式條

若失敗，先檢查 Railway：

- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_LOGIN_DISPLAY_NAME`

### 3.3 授權碼 / 租戶檢查

檢查項目：

1. 租戶是否可正常進入系統
2. 過期租戶是否會被擋下
3. `/license-center` 是否可正常顯示

若授權異常，優先檢查：

- `tenants`
- `tenant_users`
- `license_keys`
- `licenseExpiresAt`
- `Tenant.status`

## 4. AI 工作流檢查

### 4.1 URL Analysis

測試流程：

1. 進入 `/url-analysis`
2. 貼上 URL
3. 按驗證
4. 確認有來源資訊、標題或預覽
5. 按開始分析
6. 確認進度條與分析結果正常

### 4.2 Video Studio

測試流程：

1. 進入 `/video-studio`
2. 確認 OpenAI / Gemini 綁定區正常顯示
3. 確認模型選擇與啟用狀態正常
4. 測試分析結果能否送進影片生成

### 4.3 AI API 異常排查

優先檢查：

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- AI 綁定狀態
- provider 是否被停用
- tenant 授權是否過期

## 5. 社群綁定與發布 SOP

### 5.1 社群綁定檢查

路徑：

- Admin `/integrations`

檢查項目：

1. 手動綁定表單是否正常
2. Facebook / Instagram / Threads / YouTube 教學卡是否顯示
3. 綁定成功後是否能讀到帳號名稱
4. 失敗時是否顯示讀取失敗

### 5.2 發布中心檢查

路徑：

- Web `/publishing-center`

檢查項目：

1. READY 影片是否可送出發布
2. 發布任務是否建立成功
3. 發布記錄是否可查詢
4. 失敗任務是否有 error message

## 6. 常見故障排查 SOP

### 6.1 API 活著但前台報錯

優先檢查：

- `NEXT_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`
- `CORS_ORIGIN`

### 6.2 Meta / Google callback 失敗

優先檢查：

- Meta `Valid OAuth Redirect URIs`
- Google OAuth redirect URI
- `FB_REDIRECT_URI`
- `APP_BASE_URL`

### 6.3 Railway 重部署後登入失敗

優先檢查：

- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- 是否有 redeploy
- 是否修改到正確 service

### 6.4 發布失敗

優先檢查：

- adapter token 是否過期
- tenant 授權是否過期
- 影片狀態是否為 `READY`
- 影片 URL 是否為公開 HTTPS

## 7. 環境變數維護 SOP

### 7.1 Railway 必查

- `DATABASE_URL`
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`
- `ADMIN_LOGIN_DISPLAY_NAME`
- `APP_BASE_URL`
- `WEB_BASE_URL`
- `CORS_ORIGIN`
- `FB_APP_ID`
- `FB_APP_SECRET`
- `FB_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

### 7.2 Vercel 必查

Web：

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_BASE_URL`

Admin：

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ADMIN_BASE_URL`

## 8. 發版 SOP

1. 本機 build：
   - `npm --workspace @ai-vidio/web run build`
   - `npm --workspace @ai-vidio/admin-dashboard run build`
   - `npm --workspace @ai-vidio/api run build`
2. push 到 GitHub `main`
3. 等待 Vercel / Railway 自動部署
4. 部署後驗：
   - API `/health`
   - Web `/login`
   - Admin `/login`
   - `/video-studio`
   - `/integrations`

## 9. 交接備註

- 如需對外交付，請同步提供：
  - `DELIVERY-CHECKLIST.md`
  - `HANDOFF-GUIDE.md`
  - 這份 `OPERATIONS-SOP.md`
- 正式憑證與密碼不要只寫在文件，應放到受控密碼管理器
