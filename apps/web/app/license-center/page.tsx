"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { writeTenantSession } from "../../lib/tenant-session";

type ActivationResponse = {
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
      const response = await apiFetch<ActivationResponse>("/tenancy/license-keys/activate", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim(),
          tenantName: form.tenantName.trim(),
          workspaceName: form.workspaceName.trim() || undefined,
          userName: form.userName.trim(),
          userEmail: form.userEmail.trim().toLowerCase()
        })
      });

      writeTenantSession({
        tenantId: response.tenant.id,
        tenantName: response.tenant.name,
        tenantStatus: response.tenant.status,
        plan: response.tenant.plan,
        licenseExpiresAt: response.tenant.licenseExpiresAt,
        workspaceId: response.workspace.id,
        workspaceName: response.workspace.name,
        workspaceSlug: response.workspace.slug,
        userId: response.user.id,
        userEmail: response.user.email,
        userName: response.user.name
      });

      setSuccess(`已啟用 ${response.tenant.name}，正在帶你進入工作台`);
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
              <p className="eyebrow">SaaS Activation</p>
              <h1 className="panel-title">啟用你的 Tenant 授權碼</h1>
              <p className="panel-desc">這個專案目前還沒有正式 auth provider，所以我們先用最小可用流程：輸入授權碼後建立 Tenant、Workspace，接著整套系統就會綁到你的租戶。</p>
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
                  placeholder="例如：YunNuoChing 團隊"
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
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "啟用中..." : "啟用授權碼"}
              </button>
              <span className="status status-muted">啟用成功後會自動建立 Tenant 與 Workspace</span>
            </div>
          </form>

          {error ? <div className="form-alert danger">{error}</div> : null}
          {success ? <div className="form-alert success">{success}</div> : null}
        </div>
      </section>
    </div>
  );
}
