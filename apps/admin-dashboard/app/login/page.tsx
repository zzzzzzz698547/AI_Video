"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "../../lib/api";
import { isAdminSessionExpired, readAdminSession, writeAdminSession } from "../../lib/admin-session";

type AdminLoginResponse = {
  success: boolean;
  data: {
    token: string;
    user: {
      username: string;
      displayName: string;
      role: "SUPER_ADMIN";
    };
    expiresAt: string;
  };
};

type AdminSessionResponse = {
  success: boolean;
  data: {
    username: string;
    displayName: string;
    role: "SUPER_ADMIN";
    expiresAt: string;
  };
};

const defaultForm = {
  username: "",
  password: ""
};

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = searchParams.get("next") || "/integrations";
  const handoffToken = searchParams.get("token");

  useEffect(() => {
    const currentSession = readAdminSession();
    if (currentSession && !isAdminSessionExpired(currentSession)) {
      router.replace(nextPath);
      return;
    }

    if (!handoffToken) {
      return;
    }

    let cancelled = false;

    async function verifyToken() {
      setVerifying(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl("/auth/admin/session")}?token=${encodeURIComponent(handoffToken)}`, {
          cache: "no-store"
        });

        const payload = (await response.json()) as AdminSessionResponse | { error?: { message?: string } };
        if (!response.ok || !("success" in payload && payload.success)) {
          throw new Error(("error" in payload && payload.error?.message) || "管理員登入驗證失敗");
        }

        if (cancelled) {
          return;
        }

        writeAdminSession({
          username: payload.data.username,
          displayName: payload.data.displayName,
          role: payload.data.role,
          token: handoffToken,
          expiresAt: payload.data.expiresAt
        });

        router.replace(nextPath);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "管理員登入驗證失敗");
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    }

    void verifyToken();

    return () => {
      cancelled = true;
    };
  }, [handoffToken, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/auth/admin/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password
        })
      });

      const payload = (await response.json()) as AdminLoginResponse | { error?: { message?: string } };
      if (!response.ok || !("success" in payload && payload.success)) {
        throw new Error(("error" in payload && payload.error?.message) || "管理員登入失敗");
      }

      writeAdminSession({
        username: payload.data.user.username,
        displayName: payload.data.user.displayName,
        role: payload.data.user.role,
        token: payload.data.token,
        expiresAt: payload.data.expiresAt
      });

      router.replace(nextPath);
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
              <h1 className="panel-title">管理員直接登入</h1>
              <p className="panel-desc">這條入口不吃授權碼，專門給系統管理員進後台維運、檢查綁定與排查問題。</p>
            </div>
          </div>

          {verifying ? (
            <div className="form-alert success">正在確認管理員登入憑證，稍後自動帶你進後台。</div>
          ) : (
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
                <button className="action-button primary" type="submit" disabled={loading}>
                  {loading ? "登入中..." : "登入後台"}
                </button>
                <span className="badge">登入成功後會直接略過授權碼檢查</span>
              </div>
            </form>
          )}

          {error ? <div className="form-alert danger">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
