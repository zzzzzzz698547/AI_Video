"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api";
import { CopyButton } from "../../../../components/copy-button";

type DeletionStatus = {
  confirmationCode: string;
  metaUserId: string;
  status: "RECEIVED" | "PROCESSING" | "COMPLETED" | "NOT_FOUND" | "FAILED";
  callbackUrl: string;
  statusUrl: string;
  deletedPlatformAccounts: number;
  deletedPlatformTokens: number;
  deletedChannelAdapters: number;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
};

export default function MetaDataDeletionStatusPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const [data, setData] = useState<DeletionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setError("Missing confirmation code");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiFetch<{ request: DeletionStatus }>(`/meta/data-deletion/status/${encodeURIComponent(code)}`)
      .then((response) => {
        if (!cancelled) {
          setData(response.request);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load deletion status");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="stack">
      <section className="panel hero-panel">
        <div className="panel-inner hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Meta Data Deletion</p>
            <h1 className="title">刪除狀態查詢</h1>
            <p className="subtle">
              這是 Meta 資料刪除要求的狀態頁。當 callback 完成後，系統會在這裡顯示 confirmation code 與處理結果。
            </p>
            <div className="chip-row">
              <span className="chip">confirmation: {code}</span>
              <CopyButton text={code} label="複製 code" />
            </div>
          </div>
          <div className="hero-stack">
            <div className="panel" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="panel-inner">
                <h2 style={{ marginTop: 0 }}>回呼摘要</h2>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  callback: <br />
                  <span style={{ color: "var(--text)" }}>/meta/data-deletion</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          {loading ? (
            <p className="subtle">載入中...</p>
          ) : error ? (
            <div className="variant-card" style={{ borderColor: "rgba(251, 113, 133, 0.45)", background: "rgba(251, 113, 133, 0.08)" }}>
              <strong>無法載入狀態</strong>
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="stack">
              <div className="variant-card">
                <strong>狀態</strong>
                <p>{data.status}</p>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">平台帳號</div>
                  <div className="stat-value">{data.deletedPlatformAccounts}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Tokens</div>
                  <div className="stat-value">{data.deletedPlatformTokens}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Adapters</div>
                  <div className="stat-value">{data.deletedChannelAdapters}</div>
                </div>
              </div>
              <div className="variant-card">
                <strong>Meta User ID</strong>
                <p>{data.metaUserId}</p>
              </div>
              {data.errorMessage ? (
                <div className="variant-card" style={{ borderColor: "rgba(251, 113, 133, 0.45)", background: "rgba(251, 113, 133, 0.08)" }}>
                  <strong>錯誤訊息</strong>
                  <p>{data.errorMessage}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
