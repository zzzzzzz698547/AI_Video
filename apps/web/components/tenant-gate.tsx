"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/api";
import {
  getTenantRemainingDays,
  isTenantSessionExpired,
  readTenantSession,
  type TenantSession,
  updateTenantSession
} from "../lib/tenant-session";

const PUBLIC_PATHS = new Set(["/license-center", "/license-expired", "/renewal", "/meta/data-deletion"]);

type TenantLicenseStatus = {
  tenantId: string;
  name: string;
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
  plan: "BASIC" | "PRO" | "ENTERPRISE";
  licenseExpiresAt: string;
  remainingDays: number;
  isUsable: boolean;
};

export function TenantGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<TenantSession | null | undefined>(undefined);
  const [licenseStatus, setLicenseStatus] = useState<TenantLicenseStatus | null>(null);

  useEffect(() => {
    const nextSession = readTenantSession();
    setSession(nextSession);
    setLicenseStatus(null);

    if (PUBLIC_PATHS.has(pathname)) {
      return;
    }

    if (!nextSession || isTenantSessionExpired(nextSession)) {
      router.replace(nextSession ? "/license-expired" : "/license-center");
      return;
    }

    const stableSession = nextSession;
    let cancelled = false;

    async function verifyTenantStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/tenancy/tenants/${stableSession.tenantId}/license-status`);
        const payload = (await response.json()) as TenantLicenseStatus | { error?: { code?: string; message?: string } };

        if (!response.ok) {
          const code = "error" in payload ? payload.error?.code : undefined;
          if (code === "LICENSE_EXPIRED" && !cancelled) {
            updateTenantSession({
              tenantStatus: "EXPIRED"
            });
            router.replace("/license-expired");
            return;
          }

          if (!cancelled) {
            router.replace("/license-center");
          }
          return;
        }

        if (cancelled) {
          return;
        }

        const status = payload as TenantLicenseStatus;
        updateTenantSession({
          tenantStatus: status.status,
          licenseExpiresAt: status.licenseExpiresAt
        });
        setLicenseStatus(status);

        if (!status.isUsable || status.status !== "ACTIVE") {
          router.replace("/license-expired");
        }
      } catch {
        if (!cancelled) {
          router.replace("/license-center");
        }
      }
    }

    void verifyTenantStatus();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  if (session === undefined) {
    return (
      <div className="workspace-guard">
        <div className="workspace-guard-card">
          <h1>正在確認授權狀態</h1>
          <p>系統會先檢查你的 Tenant 與授權碼是否可用。</p>
        </div>
      </div>
    );
  }

  if (!session || isTenantSessionExpired(session)) {
    return (
      <div className="workspace-guard">
        <div className="workspace-guard-card">
          <h1>需要先啟用授權碼</h1>
          <p>請先完成 Tenant 啟用，之後我們再讓內容、影片與發布流程接著跑。</p>
        </div>
      </div>
    );
  }

  const remainingDays = licenseStatus?.remainingDays ?? getTenantRemainingDays(session);
  const showRenewalReminder = remainingDays <= 14;

  return (
    <>
      {showRenewalReminder ? (
        <div className="tenant-license-banner">
          <div>
            <strong>授權剩餘 {remainingDays} 天</strong>
            <span>{remainingDays <= 3 ? " 授權即將到期，建議立即續費，避免 AI 生成與發布流程中斷。" : " 建議先安排續費，避免主要功能被停用。"}</span>
          </div>
          <button className="banner-link" type="button" onClick={() => router.push("/renewal")}>
            前往續費
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
