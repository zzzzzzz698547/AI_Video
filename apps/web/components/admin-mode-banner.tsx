"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession, isAdminSessionExpired, readAdminSession, type AdminSession } from "../lib/admin-session";

function formatRemaining(expiresAt: string) {
  const diff = Date.parse(expiresAt) - Date.now();
  if (Number.isNaN(diff) || diff <= 0) {
    return "已過期";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours <= 0) {
    return `${Math.max(minutes, 1)} 分鐘`;
  }

  return `${hours} 小時 ${minutes} 分鐘`;
}

function formatExpiry(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

const PUBLIC_PATHS = new Set(["/login"]);

export function AdminModeBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) {
      setSession(null);
      return;
    }

    const current = readAdminSession();
    if (!current || isAdminSessionExpired(current)) {
      if (current) {
        clearAdminSession();
      }
      setSession(null);
      return;
    }

    setSession(current);
  }, [pathname]);

  const remaining = useMemo(() => (session ? formatRemaining(session.expiresAt) : null), [session]);
  const expiresLabel = useMemo(() => (session ? formatExpiry(session.expiresAt) : null), [session]);

  function handleLogout() {
    clearAdminSession();
    setSession(null);
    router.replace("/login");
  }

  if (!session) {
    return null;
  }

  return (
    <section className="admin-mode-banner">
      <div className="admin-mode-copy">
        <p className="admin-mode-eyebrow">管理員模式已啟用</p>
        <div className="admin-mode-title-row">
          <strong>{session.displayName}</strong>
          <span className="meta">{session.username}</span>
        </div>
        <p className="admin-mode-meta">
          目前前台已略過授權碼限制，還可使用 <strong>{remaining}</strong>。到期時間：{expiresLabel}
        </p>
      </div>
      <div className="admin-mode-actions">
        <span className="meta">SUPER ADMIN</span>
        <button className="btn btn-secondary" type="button" onClick={handleLogout}>
          登出管理員
        </button>
      </div>
    </section>
  );
}
