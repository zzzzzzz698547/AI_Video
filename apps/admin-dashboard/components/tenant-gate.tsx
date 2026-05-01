"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isTenantSessionExpired, readTenantSession, type TenantSession } from "../lib/tenant-session";

const PUBLIC_PATHS = new Set(["/license-center"]);

export function TenantGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<TenantSession | null | undefined>(undefined);

  useEffect(() => {
    const nextSession = readTenantSession();
    setSession(nextSession);

    if (PUBLIC_PATHS.has(pathname)) {
      return;
    }

    if (!nextSession || isTenantSessionExpired(nextSession)) {
      router.replace("/license-center");
    }
  }, [pathname, router]);

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  if (session === undefined) {
    return (
      <div className="workspace-guard">
        <div className="workspace-guard-card">
          <h1>正在確認授權狀態</h1>
          <p>後台會先檢查目前 Tenant 是否有效，再讓你進入整合與營運模組。</p>
        </div>
      </div>
    );
  }

  if (!session || isTenantSessionExpired(session)) {
    return (
      <div className="workspace-guard">
        <div className="workspace-guard-card">
          <h1>需要先啟用授權碼</h1>
          <p>請先完成 Tenant 啟用，之後我們再讓後台管理中心接著跑。</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
