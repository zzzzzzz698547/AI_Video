"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../lib/api";
import { writeTenantSession } from "../../lib/tenant-session";

type ActivationResponse = {
  success: boolean;
  data: {
    tenant: {
      id: string;
      name: string;
      status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
      plan: "BASIC" | "PRO" | "ENTERPRISE";
      licenseExpiresAt: string;
    };
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
    user: {
      id: string;
      email: string;
      name: string;
    };
    licenseKey: {
      code: string;
      status: string;
    };
  };
};

const defaultForm = {
  code: "",
  tenantName: "",
  workspaceName: "",
  userName: "",
  userEmail: ""
};

export default function LicenseCenterPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(apiUrl("/tenancy/license-keys/activate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          tenantName: form.tenantName.trim(),
          workspaceName: form.workspaceName.trim() || undefined,
          userName: form.userName.trim(),
          userEmail: form.userEmail.trim().toLowerCase()
        })
      });

      const payload = (await response.json()) as ActivationResponse | { message?: string; error?: { message?: string } };
      if (!response.ok || !("success" in payload && payload.success)) {
        throw new Error(("error" in payload && payload.error?.message) || ("message" in payload && payload.message) || "授權碼啟用失敗");
      }

      writeTenantSession({
        tenantId: payload.data.tenant.id,
        tenantName: payload.data.tenant.name,
        tenantStatus: payload.data.tenant.status,
        plan: payload.data.tenant.plan,
        licenseExpiresAt: payload.data.tenant.licenseExpiresAt,
        workspaceId: payload.data.workspace.id,
        workspaceName: payload.data.workspace.name,
        workspaceSlug: payload.data.workspace.slug,
        userId: payload.data.user.id,
        userEmail: payload.data.user.email,
        userName: payload.data.user.name
      });

      setSuccess(`已啟用 ${payload.data.tenant.name}，正在帶你進入後台管理中心`);
      window.setTimeout(() => router.replace("/"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "授權碼啟用失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="license-shell">
      <section className="panel license-panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Admin SaaS Activation</p>
              <h1 className="panel-title">啟用後台 Tenant 授權碼</h1>
              <p className="panel-desc">先完成 Tenant 啟用，後台的社群綁定、轉單、客服與分析模組都會自動綁到你的租戶。</p>
            </div>
          </div>

          <form className="stack" onSubmit={handleActivate}>
            <div className="form-grid">
              <label className="field">
                <span className="label">授權碼</span>
                <input
                  className="input"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  placeholder="JX-XXXX-XXXX-XXXX"
                  required
                />
              </label>

              <label className="field">
                <span className="label">Tenant 名稱</span>
                <input
                  className="input"
                  value={form.tenantName}
                  onChange={(event) => setForm({ ...form, tenantName: event.target.value })}
                  placeholder="例如：AI-VIDIO 團隊"
                  required
                />
              </label>

              <label className="field">
                <span className="label">Workspace 名稱</span>
                <input
                  className="input"
                  value={form.workspaceName}
                  onChange={(event) => setForm({ ...form, workspaceName: event.target.value })}
                  placeholder="可留空，會預設跟 Tenant 同名"
                />
              </label>

              <label className="field">
                <span className="label">使用者名稱</span>
                <input
                  className="input"
                  value={form.userName}
                  onChange={(event) => setForm({ ...form, userName: event.target.value })}
                  placeholder="例如：蔡正源"
                  required
                />
              </label>

              <label className="field field-full">
                <span className="label">使用者 Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.userEmail}
                  onChange={(event) => setForm({ ...form, userEmail: event.target.value })}
                  placeholder="you@example.com"
                  required
                />
              </label>
            </div>

            <div className="toolbar">
              <button className="action-button primary" type="submit" disabled={loading}>
                {loading ? "啟用中..." : "啟用授權碼"}
              </button>
              <span className="badge">啟用成功後會自動建立 Tenant、TenantUser 與 Workspace</span>
            </div>
          </form>

          {error ? <div className="form-alert danger">{error}</div> : null}
          {success ? <div className="form-alert success">{success}</div> : null}
        </div>
      </section>
    </div>
  );
}
