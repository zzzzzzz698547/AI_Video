"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { isAdminSessionExpired, readAdminSession } from "../../lib/admin-session";

type AdminLoginResponse = {
  token: string;
  user: {
    username: string;
    displayName: string;
    role: "SUPER_ADMIN";
  };
  expiresAt: string;
};

const defaultForm = {
  username: "",
  password: ""
};

function normalizeBaseUrl(value?: string) {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^["'\s\\]+/, "")
    .replace(/["'\s\\]+$/, "")
    .replace(/\/+$/, "");
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adminBaseUrl = useMemo(() => normalizeBaseUrl(process.env.NEXT_PUBLIC_ADMIN_BASE_URL) || "http://localhost:3002", []);

  useEffect(() => {
    const currentSession = readAdminSession();
    if (currentSession && !isAdminSessionExpired(currentSession)) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<AdminLoginResponse>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password
        })
      });

      window.location.href = `${adminBaseUrl}/login?token=${encodeURIComponent(response.token)}&next=${encodeURIComponent("/integrations")}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "管理員登入失敗");
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
              <p className="eyebrow">Admin Sign In</p>
              <h1 className="panel-title">管理員登入入口</h1>
              <p className="panel-desc">管理員可直接用帳號密碼登入後台，不需要先輸入授權碼。一般客戶仍然維持授權中心啟用流程。</p>
            </div>
          </div>

          <form className="stack admin-login-form" onSubmit={handleSubmit}>
            <div className="admin-login-grid">
              <label className="admin-login-field">
                <span className="admin-login-label">帳號</span>
                <input
                  className="input admin-login-input"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="管理員帳號"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="admin-login-field">
                <span className="admin-login-label">密碼</span>
                <input
                  className="input admin-login-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="管理員密碼"
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>

            <div className="toolbar admin-login-toolbar">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "登入中..." : "前往後台"}
              </button>
              <span className="status status-muted">登入成功後會自動跳到後台管理中心</span>
            </div>
          </form>

          {error ? <div className="form-alert danger">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
