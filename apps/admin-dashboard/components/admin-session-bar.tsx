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

export function AdminSessionBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    const nextSession = readAdminSession();
    if (!nextSession || isAdminSessionExpired(nextSession)) {
      if (nextSession) {
        clearAdminSession();
      }
      setSession(null);
      return;
    }

    setSession(nextSession);
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
    <section className="admin-session-bar">
      <div className="admin-session-copy">
        <p className="admin-session-eyebrow">管理員模式</p>
        <div className="admin-session-title-row">
          <strong>{session.displayName}</strong>
          <span className="badge">{session.username}</span>
        </div>
        <p className="admin-session-meta">
          已記住登入狀態，還可使用 <strong>{remaining}</strong>。到期時間：{expiresLabel}
        </p>
      </div>
      <div className="admin-session-actions">
        <span className="badge">SUPER ADMIN</span>
        <button className="action-button danger" type="button" onClick={handleLogout}>
          登出管理員
        </button>
      </div>
    </section>
  );
}
