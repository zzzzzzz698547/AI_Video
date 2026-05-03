# AI-VIDIO 客戶交付說明

## 1. 交付概述

AI-VIDIO 是一套多租戶 SaaS AI 影片與社群發布系統，已包含：

- 授權碼啟用
- AI 內容分析
- AI 影片生成
- 社群帳號綁定
- 社群發布與發布紀錄
- 管理員後台

## 2. 正式網址

- Web：[https://ai-vidio-web.vercel.app](https://ai-vidio-web.vercel.app)
- Admin：[https://ai-vidio-admin.vercel.app](https://ai-vidio-admin.vercel.app)
- API：[https://ai-vidio-api-production.up.railway.app](https://ai-vidio-api-production.up.railway.app)

## 3. 主要功能

### 3.1 授權與租戶

- 可使用授權碼啟用系統
- 每個客戶以 Tenant 方式獨立管理
- 授權過期後會限制主要功能

### 3.2 URL 分析

- 貼上 YouTube / TikTok / IG / FB / 一般網頁網址
- 驗證來源資訊
- 顯示分析進度
- 輸出摘要、切點、腳本方向

### 3.3 影片工作台

- 接收分析結果
- 進入 Video Studio
- 選擇 AI 綁定與模型
- 生成影片工作流

### 3.4 社群綁定

目前支援：

- Facebook
- Instagram
- Threads
- YouTube

可用方式：

- OAuth 綁定
- 手動綁定

### 3.5 發布中心

- 可查詢影片發布記錄
- 可建立社群發布任務
- 可保留錯誤訊息與任務狀態

## 4. 已交付平台

- Web 前台
- Admin 後台
- API 後端
- Railway PostgreSQL

## 5. 驗收建議

### 前台驗收

1. 打開 `/login`
2. 打開 `/license-center`
3. 打開 `/url-analysis`
4. 測試貼網址驗證與分析
5. 打開 `/video-studio`
6. 確認 AI 綁定區正常
7. 打開 `/publishing-center`

### 後台驗收

1. 打開 `/login`
2. 打開 `/integrations`
3. 測試手動綁定畫面
4. 檢查綁定教學卡

## 6. 注意事項

- 系統部分功能依賴第三方平台 API 設定
- Meta / Google OAuth callback 需要正確配置
- OpenAI / Gemini 綁定需填入有效 API Key
- 管理員登入與正式環境憑證建議由受控密碼管理器保存

## 7. 建議移交項目

建議交付時一併提供：

- 正式網址
- 管理員登入資訊
- 第三方平台設定說明
- Railway / Vercel 存取權限
- 本 repo 文件：
  - `DELIVERY-CHECKLIST.md`
  - `HANDOFF-GUIDE.md`
  - `OPERATIONS-SOP.md`
