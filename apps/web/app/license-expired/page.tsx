"use client";

import Link from "next/link";
import { readTenantSession, getTenantRemainingDays } from "../../lib/tenant-session";

export default function LicenseExpiredPage() {
  const session = readTenantSession();
  const remainingDays = getTenantRemainingDays(session);

  return (
    <div className="license-shell">
      <section className="panel license-panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <p className="eyebrow">License Expired</p>
              <h1 className="panel-title">你的 SaaS 授權已到期</h1>
              <p className="panel-desc">
                {session
                  ? `${session.tenantName} 目前已無法使用 AI 影片生成、影片管理、社群綁定與發布功能。`
                  : "目前無法確認你的 Tenant 狀態，請重新啟用授權碼或前往續費。"}
              </p>
            </div>
          </div>

          <div className="license-summary-card">
            <div className="license-summary-grid">
              <div>
                <span className="label">Tenant</span>
                <strong>{session?.tenantName ?? "未載入"}</strong>
              </div>
              <div>
                <span className="label">方案</span>
                <strong>{session?.plan ?? "未載入"}</strong>
              </div>
              <div>
                <span className="label">授權狀態</span>
                <strong>EXPIRED</strong>
              </div>
              <div>
                <span className="label">剩餘天數</span>
                <strong>{remainingDays}</strong>
              </div>
            </div>
          </div>

          <div className="toolbar">
            <Link className="btn" href="/renewal">
              前往續費
            </Link>
            <Link className="btn btn-secondary" href="/license-center">
              重新啟用授權碼
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
