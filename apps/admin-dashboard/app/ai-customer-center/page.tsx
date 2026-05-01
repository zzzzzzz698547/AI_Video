import Link from "next/link";

export const dynamic = "force-dynamic";

const conversations = [
  ["#convo-2041", "高意向", "IG", "已 AI 接手"],
  ["#convo-2042", "詢價中", "Facebook", "需補價格"],
  ["#convo-2043", "客訴", "LINE", "待人工接手"],
  ["#convo-2044", "售後", "Threads", "追蹤中"]
];

const knowledgeStats = [
  ["常見問題", "42"],
  ["商品資料", "18"],
  ["禁用詞", "12"],
  ["話術模板", "26"]
];

const followUps = [
  ["未回覆 2 小時", "自動追問"],
  ["高意向客戶", "真人提醒"],
  ["成交後", "售後 / 加購"]
];

export default function AICustomerCenterPage() {
  return (
    <div className="chat-shell">
      <header className="chat-hero">
        <p className="eyebrow">AI 客服中心</p>
        <h1 className="title">把訊息接住，把客戶推進成交</h1>
        <p className="subtle">
          對話、意圖、評分、知識庫、接手與跟進都在同一個工作台。AI 先回、再判斷、再推進，必要時立即交給真人。
        </p>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <Link className="btn" href="/ai-customer-center/conversations/convo-2041">
            查看對話詳情
          </Link>
          <Link className="btn btn-secondary" href="/ai-customer-center/knowledge-base">
            管理知識庫
          </Link>
          <Link className="btn btn-secondary" href="/ai-customer-center/handoff">
            轉人工監控
          </Link>
        </div>
      </header>

      <section className="chat-grid">
        {[
          ["總對話數", "1,284"],
          ["高意向名單", "96"],
          ["待接手", "14"],
          ["今日成交", "28"]
        ].map(([label, value]) => (
          <article key={label} className="card">
            <p className="muted">{label}</p>
            <h2>{value}</h2>
          </article>
        ))}
      </section>

      <section className="chat-layout">
        <article className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">對話總覽</h2>
                <p className="panel-desc">最近訊息、狀態、熱度與接手狀況一眼看完。</p>
              </div>
            </div>
            <div className="conversation-list">
              {conversations.map(([id, stage, source, status]) => (
                <Link key={id} className="conversation-item" href={`/ai-customer-center/conversations/${id.replace("#", "")}`}>
                  <div>
                    <strong>{id}</strong>
                    <p className="muted" style={{ margin: "6px 0 0" }}>
                      {source} · {stage}
                    </p>
                  </div>
                  <span className="badge">{status}</span>
                </Link>
              ))}
            </div>
          </div>
        </article>

        <div className="stack">
          <article className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">知識庫摘要</h2>
                  <p className="panel-desc">FAQ、商品資料、話術與禁用詞都集中管理。</p>
                </div>
              </div>
              <div className="score-grid">
                {knowledgeStats.map(([label, value]) => (
                  <div key={label} className="score-card">
                    <p className="muted">{label}</p>
                    <div className="score-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">自動跟進設定</h2>
                  <p className="panel-desc">未回覆、熱名單與成交後續都能自動排程。</p>
                </div>
              </div>
              <div className="rule-list">
                {followUps.map(([label, action]) => (
                  <div key={label} className="rule-item">
                    <strong>{label}</strong>
                    <p className="muted">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
