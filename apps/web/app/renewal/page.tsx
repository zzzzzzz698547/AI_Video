"use client";

import Link from "next/link";
import { readTenantSession } from "../../lib/tenant-session";

export default function RenewalPage() {
  const session = readTenantSession();

  return (
    <div className="license-shell">
      <section className="panel license-panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Renewal</p>
              <h1 className="panel-title">續費與授權更新</h1>
              <p className="panel-desc">
                {session
                  ? `我們已保留 ${session.tenantName} 的租戶資料。續費後就能恢復 AI 生成、社群綁定與發布流程。`
                  : "請聯繫系統管理員或重新取得授權碼，完成續費後即可恢復主要功能。"}
              </p>
            </div>
          </div>

          <div className="renewal-card">
            <p>目前這個專案還沒有正式串接金流與訂閱管理，因此續費流程先走人工處理。</p>
            <ul className="renewal-list">
              <li>確認你的 Tenant 方案與需求人數</li>
              <li>取得新的授權碼或延展授權期限</li>
              <li>回到授權中心重新啟用，或由管理員更新 Tenant 狀態</li>
            </ul>
          </div>

          <div className="toolbar">
            <Link className="btn" href="/license-center">
              回授權中心
            </Link>
            <a className="btn btn-secondary" href="mailto:support@ai-vidio.local">
              聯繫續費
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
