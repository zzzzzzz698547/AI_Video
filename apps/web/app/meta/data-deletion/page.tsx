"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export default function MetaDataDeletionInfoPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const callbackUrl = useMemo(() => "/meta/data-deletion", []);
  const statusUrl = useMemo(() => "/meta/data-deletion-status/:confirmationCode", []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      return;
    }
    router.push(`/meta/data-deletion-status/${encodeURIComponent(value)}`);
  }

  return (
    <div className="stack">
      <section className="panel hero-panel">
        <div className="panel-inner hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Meta Data Deletion</p>
            <h1 className="title">資料刪除回呼說明</h1>
            <p className="subtle">
              這個頁面是給 Meta 與使用者查看資料刪除說明的公開網址。當 Meta 呼叫回呼時，系統會刪除與 Facebook / Instagram /
              Threads 綁定相關的帳號資料，並回傳刪除狀態。
            </p>
            <div className="chip-row">
              <span className="chip">callback: {callbackUrl}</span>
              <span className="chip">status: {statusUrl}</span>
            </div>
          </div>

            <div className="hero-stack">
              <div className="panel" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="panel-inner">
                  <h2 style={{ marginTop: 0 }}>會刪除的資料</h2>
                  <ul className="meta-list">
                    <li>Facebook / Instagram / Threads 的平台綁定帳號</li>
                    <li>對應的 token 與授權紀錄</li>
                    <li>關聯的 channel adapter 狀態</li>
                  </ul>
                </div>
            </div>
            <div className="panel" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="panel-inner">
                <h2 style={{ marginTop: 0 }}>處理流程</h2>
                <ol className="meta-list">
                  <li>接收 Meta signed_request</li>
                  <li>驗證簽章與 user_id</li>
                  <li>刪除綁定資料</li>
                  <li>回傳 confirmation code 與狀態頁</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Status Check</p>
              <h2 className="panel-title">查詢刪除進度</h2>
            </div>
          </div>

          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span className="label">Confirmation Code</span>
              <input
                className="input"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="例如：MDD..."
              />
            </label>

            <div className="toolbar">
              <button className="btn" type="submit">
                查看狀態
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
