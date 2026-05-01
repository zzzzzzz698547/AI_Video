"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../../lib/api";
import { readTenantSession, type TenantSession } from "../../lib/tenant-session";

type Provider = {
  platform: "FACEBOOK" | "INSTAGRAM" | "THREADS" | "YOUTUBE";
  label: string;
  provider: string;
  description: string;
  callbackPath: string;
  scopes: string[];
  permissionStages: {
    key: "PUBLISH" | "ENGAGEMENT" | "MESSAGING";
    label: string;
    description: string;
    scopes: string[];
    supported: boolean;
  }[];
  status: "READY" | "NEEDS_CONFIG";
  mode: "MOCK" | "OAUTH";
};

type Account = {
  id: string;
  workspaceId: string;
  brandId: string | null;
  platform: string;
  accountName: string;
  displayName: string | null;
  externalAccountId: string | null;
  isActive: boolean;
  provider: string;
  tokenExpiresAt: string | null;
  tokenScopes: string[];
  adapterType: string | null;
  adapterStatus: string | null;
  lastSyncedAt: string | null;
  metadata: Record<string, unknown> | null;
};

type ManualBindFormState = {
  platform: Provider["platform"];
  accountName: string;
  displayName: string;
  externalAccountId: string;
  accessToken: string;
  refreshToken: string;
  scopes: string;
  adapterStatus: "ACTIVE" | "PAUSED";
};

type ManualBindResult = Account & {
  readStatus?: "SUCCESS" | "FAILED";
  readAccountName?: string;
  readDisplayName?: string;
  readSource?: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

const BRANDS = [
  { id: "all", name: "全部品牌" },
  { id: "demo-brand", name: "預設品牌" },
  { id: "beauty-brand", name: "美妝品牌" },
  { id: "tech-brand", name: "科技品牌" }
] as const;
const PLATFORM_ORDER: Provider["platform"][] = ["FACEBOOK", "INSTAGRAM", "THREADS", "YOUTUBE"];
const PLATFORM_TUTORIALS = [
  {
    platform: "FACEBOOK",
    label: "Facebook Page",
    summary: "綁定粉專後可發文、排程與同步訊息。",
    callbackPath: "/integrations/callback/facebook",
    steps: ["登入管理員帳號", "確認 OAuth 權限", "完成授權後回到後台"]
  },
  {
    platform: "INSTAGRAM",
    label: "Instagram Professional",
    summary: "綁定專業帳號後可做內容發布與 DM 整合。",
    callbackPath: "/integrations/callback/instagram",
    steps: ["確認是專業帳號", "完成 Meta 授權", "綁定成功後顯示帳號"]
  },
  {
    platform: "THREADS",
    label: "Threads",
    summary: "適合內容分發與來源追蹤。",
    callbackPath: "/integrations/callback/threads",
    steps: ["使用同一組 Meta App", "通過 OAuth", "確認回傳帳號名稱"]
  },
  {
    platform: "YOUTUBE",
    label: "YouTube",
    summary: "可接頻道資訊與影片相關流程。",
    callbackPath: "/integrations/callback/youtube",
    steps: ["使用 Google OAuth", "確認 redirect URI", "完成授權後讀取頻道"]
  }
] as const;

function isMockAccount(account: Account) {
  return account.metadata?.mode === "MOCK";
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as { error?: { message?: string; code?: string } };
        const message = payload.error?.message ?? `Request failed: ${response.status}`;
        const code = payload.error?.code ? ` (${payload.error.code})` : "";
        throw new Error(`${message}${code}`);
      } catch {
        throw new Error(`Request failed: ${response.status}`);
      }
    }

    const body = await response.text().catch(() => "");
    throw new Error(body ? `${response.status}: ${body}` : `Request failed: ${response.status}`);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

export default function IntegrationsPage() {
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<(typeof BRANDS)[number]["id"]>("all");
  const [manualBindOpen, setManualBindOpen] = useState(false);
  const [manualBindMessage, setManualBindMessage] = useState<string | null>(null);
  const [manualBindResult, setManualBindResult] = useState<ManualBindResult | null>(null);
  const [manualBindForm, setManualBindForm] = useState<ManualBindFormState>({
    platform: "FACEBOOK",
    accountName: "手動綁定帳號",
    displayName: "手動綁定帳號",
    externalAccountId: "",
    accessToken: "",
    refreshToken: "",
    scopes: "",
    adapterStatus: "ACTIVE"
  });

  const groupedAccounts = useMemo(
    () =>
      PLATFORM_ORDER.map((platform) => ({
        platform,
        items: accounts.filter((account) => account.platform === platform)
      })),
    [accounts]
  );

  const accountCounts = useMemo(() => {
    return groupedAccounts.reduce<Record<Provider["platform"], number>>((acc, group) => {
      acc[group.platform] = group.items.filter((account) => account.isActive && !isMockAccount(account)).length;
      return acc;
    }, {
      FACEBOOK: 0,
      INSTAGRAM: 0,
      THREADS: 0,
      YOUTUBE: 0
    });
  }, [groupedAccounts]);

  const mockAccountCounts = useMemo(() => {
    return groupedAccounts.reduce<Record<Provider["platform"], number>>((acc, group) => {
      acc[group.platform] = group.items.filter((account) => account.isActive && isMockAccount(account)).length;
      return acc;
    }, {
      FACEBOOK: 0,
      INSTAGRAM: 0,
      THREADS: 0,
      YOUTUBE: 0
    });
  }, [groupedAccounts]);

  async function loadData(brandId = selectedBrandId, workspaceId = tenantSession?.workspaceId ?? readTenantSession()?.workspaceId ?? "demo-workspace") {
    setLoading(true);
    setError(null);
    try {
      const brandQuery = brandId === "all" ? "" : `&brandId=${encodeURIComponent(brandId)}`;
      const [providerRes, accountRes] = await Promise.all([
        requestJson<{ providers: Provider[] }>("/integrations/providers"),
        requestJson<{ accounts: Account[] }>(`/integrations/accounts?workspaceId=${encodeURIComponent(workspaceId)}${brandQuery}`)
      ]);

      setProviders(providerRes.data.providers);
      setAccounts(accountRes.data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入社群綁定資料");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const session = readTenantSession();
    setTenantSession(session);
    void loadData(selectedBrandId, session?.workspaceId ?? "demo-workspace");
  }, []);

  async function startConnect(platform: Provider["platform"], stage?: Provider["permissionStages"][number]["key"]) {
    setBusyAction(`connect-${platform}`);
    setError(null);
    setSuccessMessage(null);
    try {
      const brandQuery = selectedBrandId === "all" ? "" : `&brandId=${encodeURIComponent(selectedBrandId)}`;
      const stageQuery = stage ? `&stage=${encodeURIComponent(stage)}` : "";
      const response = await requestJson<{
        authUrl: string;
        provider: string;
        mode: string;
        callbackUrl: string;
        opened?: boolean;
      }>(
        `/integrations/connect/${platform.toLowerCase()}/open?workspaceId=${encodeURIComponent(tenantSession?.workspaceId ?? "demo-workspace")}${brandQuery}${stageQuery}&accountName=${encodeURIComponent(
          `${platform} 官方帳號`
        )}`
      );
      if (response.data.opened) {
        setSuccessMessage(`已用 InPrivate / Incognito 開啟 ${platform} 授權頁`);
      } else {
        setSuccessMessage(`已開啟 ${platform} 授權頁`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法開啟綁定頁");
    } finally {
      setBusyAction(null);
    }
  }

  async function bindAllProviders() {
    setBusyAction("bind-all");
    setError(null);
    setSuccessMessage(null);
    try {
      const readyProviders = providers.filter((provider) => provider.status === "READY");
      if (readyProviders.length === 0) {
        throw new Error("尚未設定正式 OAuth 憑證，請先填入 META_APP_ID / META_APP_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
      }

      for (const provider of readyProviders) {
        await startConnect(provider.platform);
      }
      await loadData(selectedBrandId);
      setSuccessMessage("全部可綁定平台已完成授權");
    } catch (err) {
      setError(err instanceof Error ? err.message : "一鍵綁定失敗");
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshToken(accountId: string) {
    setBusyAction(`refresh-${accountId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      await requestJson(`/integrations/accounts/${accountId}/refresh-token`, { method: "POST" });
      await loadData(selectedBrandId);
      setSuccessMessage("Token 已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新 token 失敗");
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnect(accountId: string) {
    setBusyAction(`disconnect-${accountId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      await requestJson(`/integrations/accounts/${accountId}/disconnect`, { method: "POST" });
      await loadData(selectedBrandId);
      setSuccessMessage("已解除綁定");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除綁定失敗");
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectAll() {
    const confirmed = window.confirm("確定要解除目前品牌範圍內的所有綁定帳號嗎？此動作會刪除所有 token。");
    if (!confirmed) {
      return;
    }

    setBusyAction("disconnect-all");
    setError(null);
    setSuccessMessage(null);
    try {
      const brandQuery = selectedBrandId === "all" ? "" : `&brandId=${encodeURIComponent(selectedBrandId)}`;
      const response = await requestJson<{ disconnected: number }>(
        `/integrations/accounts/disconnect-all?workspaceId=${encodeURIComponent(tenantSession?.workspaceId ?? "demo-workspace")}${brandQuery}`,
        { method: "POST" }
      );

      await loadData(selectedBrandId);
      setSuccessMessage(`已解除綁定 ${response.data.disconnected} 個帳號`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "一鍵解除綁定失敗");
    } finally {
      setBusyAction(null);
    }
  }

  async function manualBindAccount() {
    setBusyAction("manual-bind");
    setError(null);
    setSuccessMessage(null);
    setManualBindMessage(null);
    setManualBindResult(null);

    try {
      if (!manualBindForm.accountName.trim()) {
        throw new Error("請先輸入帳號名稱");
      }
      if (!manualBindForm.accessToken.trim()) {
        throw new Error("請先輸入 Access Token");
      }

      const response = await requestJson<ManualBindResult>("/integrations/manual-bind", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: tenantSession?.workspaceId ?? "demo-workspace",
          brandId: selectedBrandId === "all" ? null : selectedBrandId,
          platform: manualBindForm.platform,
          accountName: manualBindForm.accountName.trim(),
          displayName: manualBindForm.displayName.trim() || manualBindForm.accountName.trim(),
          externalAccountId: manualBindForm.externalAccountId.trim() || null,
          accessToken: manualBindForm.accessToken.trim(),
          refreshToken: manualBindForm.refreshToken.trim() || null,
          scopes: manualBindForm.scopes,
          adapterStatus: manualBindForm.adapterStatus,
          metadata: {
            mode: "MANUAL",
            source: "admin-dashboard-manual-bind"
          }
        })
      });

      await loadData(selectedBrandId);
      const resolvedName = response.data.readDisplayName ?? response.data.displayName ?? response.data.accountName;
      setManualBindResult(response.data);
      setManualBindMessage(`已確認讀取：${resolvedName}`);
      setSuccessMessage(`已確認讀取：${resolvedName}`);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "手動綁定失敗";
      const message = rawMessage.startsWith("讀取失敗") ? rawMessage : `讀取失敗：${rawMessage}`;
      setError(message);
      setManualBindMessage(message);
      setManualBindResult({
        id: "",
        workspaceId: tenantSession?.workspaceId ?? "demo-workspace",
        brandId: selectedBrandId === "all" ? null : selectedBrandId,
        platform: manualBindForm.platform,
        accountName: manualBindForm.accountName.trim(),
        displayName: manualBindForm.displayName.trim() || manualBindForm.accountName.trim(),
        externalAccountId: manualBindForm.externalAccountId.trim() || null,
        isActive: false,
        provider: "",
        tokenExpiresAt: null,
        tokenScopes: [],
        adapterType: null,
        adapterStatus: null,
        lastSyncedAt: null,
        metadata: { error: message, readStatus: "FAILED" },
        readStatus: "FAILED",
        readAccountName: manualBindForm.accountName.trim(),
        readDisplayName: manualBindForm.displayName.trim() || manualBindForm.accountName.trim(),
        readSource: "manual-bind"
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteAccount(accountId: string) {
    const confirmed = window.confirm("確定要解除並刪除此綁定帳號嗎？此動作會刪除 token 與帳號資料。");
    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-${accountId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      await requestJson(`/integrations/accounts/${accountId}/delete`, { method: "POST" });
      await loadData(selectedBrandId);
      setSuccessMessage("已解除並刪除帳號");
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除綁定失敗");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="stack integrations-shell">
      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h1 className="panel-title">社群綁定中心</h1>
              <p className="panel-desc">
                在這裡直接綁定 Facebook、Instagram、Threads、YouTube。正式模式會走官方 OAuth，沒有填憑證時會清楚顯示需設定。
              </p>
            </div>
            <div className="badge-row">
              <span className="badge">tenant: {tenantSession?.tenantName ?? "未啟用"}</span>
              <span className="badge">workspace: {tenantSession?.workspaceId ?? "demo-workspace"}</span>
              <span className="badge">API: {apiUrl("/integrations/providers")}</span>
            </div>
          </div>

          <div className="integration-toolbar">
            <label className="brand-picker">
              <span className="muted">選擇品牌</span>
              <select
                className="select-field"
                value={selectedBrandId}
                onChange={(event) => {
                  const nextBrandId = event.target.value as (typeof BRANDS)[number]["id"];
                  setSelectedBrandId(nextBrandId);
                  void loadData(nextBrandId);
                }}
              >
                {BRANDS.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="toolbar-note muted">
              先選品牌，再做一鍵綁定或單平台綁定。正式綁定需要設定 META_APP_ID / META_APP_SECRET / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET。
            </div>
          </div>

          <div className="integration-toolbar" style={{ marginTop: 14 }}>
            <div className="toolbar-note muted">
              手動綁定可直接輸入 Access Token 與帳號資訊，適合測試帳號、內部工具或已取得官方 token 的情境。
            </div>
            <button className="action-button primary" type="button" onClick={() => setManualBindOpen((value) => !value)}>
              {manualBindOpen ? "關閉手動綁定" : "新增手動綁定"}
            </button>
          </div>

          <div className="badge-row" style={{ marginTop: 14 }}>
            <span className="badge">綁定結果會寫入 platform_accounts</span>
            <span className="badge">token 會加密存入 platform_tokens</span>
            <span className="badge">FB / IG 會同步 channel_adapters</span>
          </div>

          {manualBindOpen ? (
            <section className="manual-bind-card">
              <div className="panel-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="variant-title">手動綁定</h3>
                  <p className="panel-desc">直接建立帳號、Token 與 Adapter，適合你已經手上有官方 token 或要先建測試資料。</p>
                </div>
                <span className="badge warn">MANUAL</span>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span className="label">平台</span>
                  <select
                    className="select-field"
                    value={manualBindForm.platform}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        platform: event.target.value as ManualBindFormState["platform"]
                      }))
                    }
                  >
                    {PLATFORM_ORDER.map((platform) => (
                      <option key={platform} value={platform}>
                        {providers.find((item) => item.platform === platform)?.label ?? platform}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">帳號名稱</span>
                  <input
                    className="input"
                    value={manualBindForm.accountName}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        accountName: event.target.value
                      }))
                    }
                    placeholder="例如：官方粉專、主頻道、測試帳號"
                  />
                </label>
                <label className="field">
                  <span className="label">顯示名稱</span>
                  <input
                    className="input"
                    value={manualBindForm.displayName}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        displayName: event.target.value
                      }))
                    }
                    placeholder="後台顯示名稱"
                  />
                </label>
                <label className="field">
                  <span className="label">外部帳號 ID</span>
                  <input
                    className="input"
                    value={manualBindForm.externalAccountId}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        externalAccountId: event.target.value
                      }))
                    }
                    placeholder="可選"
                  />
                </label>
                <label className="field">
                  <span className="label">Access Token</span>
                  <input
                    className="input"
                    type="password"
                    value={manualBindForm.accessToken}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        accessToken: event.target.value
                      }))
                    }
                    placeholder="貼上官方 token"
                  />
                </label>
                <label className="field">
                  <span className="label">Refresh Token</span>
                  <input
                    className="input"
                    type="password"
                    value={manualBindForm.refreshToken}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        refreshToken: event.target.value
                      }))
                    }
                    placeholder="可選"
                  />
                </label>
                <label className="field">
                  <span className="label">Scopes</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={manualBindForm.scopes}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        scopes: event.target.value
                      }))
                    }
                    placeholder="一行一個或用逗號分隔，留空則使用平台預設最小 scopes"
                  />
                </label>
                <label className="field">
                  <span className="label">Adapter 狀態</span>
                  <select
                    className="select-field"
                    value={manualBindForm.adapterStatus}
                    onChange={(event) =>
                      setManualBindForm((current) => ({
                        ...current,
                        adapterStatus: event.target.value as ManualBindFormState["adapterStatus"]
                      }))
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                  </select>
                </label>
              </div>

              <div className="integration-actions compact" style={{ marginTop: 16 }}>
                <button className="action-button primary" onClick={() => void manualBindAccount()} disabled={busyAction === "manual-bind"}>
                  {busyAction === "manual-bind" ? "手動綁定中..." : "執行手動綁定"}
                </button>
                <button
                  className="action-button"
                  type="button"
                  onClick={() =>
                    {
                      setManualBindForm({
                        platform: "FACEBOOK",
                        accountName: "手動綁定帳號",
                        displayName: "手動綁定帳號",
                        externalAccountId: "",
                        accessToken: "",
                        refreshToken: "",
                        scopes: "",
                        adapterStatus: "ACTIVE"
                      });
                      setManualBindMessage(null);
                      setManualBindResult(null);
                    }
                  }
                >
                  重置欄位
                </button>
              </div>

              {manualBindMessage ? (
                <div className={`form-alert ${manualBindResult?.readStatus === "FAILED" ? "danger" : "success"}`} style={{ marginTop: 14 }}>
                  <div>{manualBindMessage}</div>
                  {manualBindResult?.readStatus === "SUCCESS" ? (
                    <div className="badge-row" style={{ marginTop: 10 }}>
                      <span className="badge">讀取得帳號：{manualBindResult.readDisplayName ?? manualBindResult.displayName ?? manualBindResult.accountName}</span>
                      {manualBindResult.externalAccountId ? <span className="badge">ID：{manualBindResult.externalAccountId}</span> : null}
                      {manualBindResult.readSource ? <span className="badge">{manualBindResult.readSource}</span> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">平台綁定</h2>
              <p className="panel-desc">按下開始綁定後，系統會先取得授權連結，再跳到官方頁面。</p>
            </div>
            <div className="integration-actions compact">
              <button className="action-button" onClick={() => void loadData()} disabled={loading || busyAction !== null}>
                {loading ? "重新整理中..." : "重新整理"}
              </button>
              <button className="action-button danger" onClick={() => void disconnectAll()} disabled={busyAction !== null || accounts.length === 0}>
                {busyAction === "disconnect-all" ? "解除中..." : "一鍵解除綁定"}
              </button>
              <button
                className="action-button primary"
                onClick={() => void bindAllProviders()}
                disabled={busyAction !== null || providers.filter((provider) => provider.status === "READY").length === 0}
              >
                {busyAction === "bind-all" ? "綁定中..." : "一鍵綁定全部"}
              </button>
            </div>
          </div>

          {successMessage ? <div className="form-alert success">{successMessage}</div> : null}
          {error ? <div className="form-alert danger">{error}</div> : null}

          <div className="integration-grid">
            {providers.map((provider) => (
              <article key={provider.platform} className="integration-card">
                <div className="integration-card-header">
                  <div>
                    <h3>{provider.label}</h3>
                    <p className="muted">{provider.description}</p>
                  </div>
                  <span className={`badge ${provider.status === "READY" ? "" : "warn"}`}>
                    {provider.mode === "MOCK" ? "測試" : "正式"} /{" "}
                    {provider.status === "READY"
                      ? accountCounts[provider.platform] > 0
                        ? `已綁定 ${accountCounts[provider.platform]} 個`
                        : "尚未綁定"
                      : "需設定憑證"}
                  </span>
                  </div>

                  <div className="tag-list" style={{ marginTop: 12 }}>
                    {provider.scopes.map((scope) => (
                      <span key={scope} className="tag">
                        {scope}
                      </span>
                    ))}
                  </div>

                  <div className="permission-stage-grid">
                    {provider.permissionStages.map((stage) => (
                      <button
                        key={stage.key}
                        className={`permission-stage-card ${stage.supported ? "" : "disabled"}`}
                        disabled={busyAction !== null || provider.status !== "READY" || !stage.supported}
                        onClick={() => void startConnect(provider.platform, stage.key)}
                        type="button"
                      >
                        <div className="permission-stage-title">{stage.label}</div>
                        <div className="permission-stage-desc">{stage.description}</div>
                        <div className="tag-list" style={{ marginTop: 10 }}>
                          {stage.scopes.length > 0 ? stage.scopes.map((scope) => (
                            <span key={scope} className="tag">
                              {scope}
                            </span>
                          )) : (
                            <span className="tag muted">未提供額外 scope</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="integration-actions">
                    <button
                      className="action-button primary"
                      onClick={() => void startConnect(provider.platform)}
                      disabled={busyAction !== null || provider.status !== "READY"}
                    >
                      {busyAction === `connect-${provider.platform}`
                        ? "綁定中..."
                        : provider.status !== "READY"
                        ? "請先設定憑證"
                        : accountCounts[provider.platform] > 0
                          ? provider.mode === "MOCK"
                            ? "重新綁定"
                            : "重新授權"
                          : provider.mode === "MOCK"
                            ? "一鍵綁定"
                            : "前往授權"}
                  </button>
                  <span className="ghost-link">callback: {provider.callbackPath}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">已綁定帳號</h2>
              <p className="panel-desc">可以看到 token 到期時間、adapter 狀態，以及是否已啟用。</p>
            </div>
          </div>

          {loading ? <div className="muted">載入中...</div> : null}

          <div className="integration-list">
            {groupedAccounts.map(({ platform, items }) => (
              <div key={platform} className="integration-group">
                <div className="integration-group-title">
                  <strong>{platform}</strong>
                  <span className="muted">
                    正式 {accountCounts[platform]} 個
                    {mockAccountCounts[platform] > 0 ? `，測試 ${mockAccountCounts[platform]} 個` : ""}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="form-hint">目前尚未綁定此平台，按上方一鍵綁定即可建立第一個帳號。</div>
                ) : (
                  items.map((account) => (
                    <article key={account.id} className="integration-account">
                      <div>
                        <div className="integration-account-title">{account.displayName ?? account.accountName}</div>
                        <div className="muted">
                          {account.provider} · {account.externalAccountId ?? "未提供外部 ID"}
                        </div>
                        <div className="badge-row" style={{ marginTop: 10 }}>
                          <span className={`badge ${account.isActive ? "" : "warn"}`}>
                            {account.isActive ? (isMockAccount(account) ? "測試綁定" : "正式綁定") : "已停用"}
                          </span>
                          <span className="badge">{account.adapterType ?? "未掛載 adapter"}</span>
                          <span className="badge">
                            {account.tokenExpiresAt ? `到期 ${new Date(account.tokenExpiresAt).toLocaleString("zh-TW")}` : "無 token"}
                          </span>
                        </div>
                      </div>

                      <div className="integration-actions compact">
                        <button
                          className="action-button"
                          onClick={() => void refreshToken(account.id)}
                          disabled={busyAction === `refresh-${account.id}`}
                        >
                          {busyAction === `refresh-${account.id}` ? "刷新中..." : "刷新 token"}
                        </button>
                        <button
                          className="action-button danger"
                          onClick={() => void disconnect(account.id)}
                          disabled={busyAction === `disconnect-${account.id}`}
                        >
                          {busyAction === `disconnect-${account.id}` ? "解除中..." : "解除綁定"}
                        </button>
                        <button
                          className="action-button danger"
                          onClick={() => void deleteAccount(account.id)}
                          disabled={busyAction === `delete-${account.id}`}
                        >
                          {busyAction === `delete-${account.id}` ? "刪除中..." : "解除並刪除"}
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">綁定教學</h2>
              <p className="panel-desc">四個平台各自的綁定步驟與回呼路徑，方便快速對照與排查。</p>
            </div>
            <span className="badge">4 Platforms</span>
          </div>

          <div className="tutorial-grid">
            {PLATFORM_TUTORIALS.map((item) => (
              <article key={item.platform} className="tutorial-card">
                <div className="tutorial-card-header">
                  <div>
                    <div className="tutorial-platform">{item.platform}</div>
                    <h3 className="tutorial-title">{item.label}</h3>
                    <p className="tutorial-summary">{item.summary}</p>
                  </div>
                  <span className="badge">{item.callbackPath}</span>
                </div>

                <ol className="tutorial-steps">
                  {item.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
