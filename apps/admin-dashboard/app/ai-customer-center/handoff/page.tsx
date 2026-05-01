export const dynamic = "force-dynamic";

const handoffQueue = [
  ["#convo-3001", "CRITICAL", "客訴"],
  ["#convo-3002", "HIGH", "高價值名單"],
  ["#convo-3003", "MEDIUM", "AI 無法判斷"]
];

const escalationRules = [
  ["抱怨 / 負評", "立即轉人工"],
  ["高意向 + 高金額", "提醒真人"],
  ["回答不確定", "標記待接手"]
];

export default function HandoffPage() {
  return (
    <div className="chat-shell">
      <header className="chat-hero">
        <p className="eyebrow">人工接手</p>
        <h1 className="title">轉人工監控</h1>
        <p className="subtle">高風險訊息、客訴與 AI 無法確定的內容都會進這一層。</p>
      </header>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">待接手對話</h2>
            <div className="handoff-list" style={{ marginTop: 12 }}>
              {handoffQueue.map(([id, severity, reason]) => (
                <div key={id} className="handoff-item">
                  <div className="badge-row">
                    <span className="badge danger">{severity}</span>
                    <span className="badge">{reason}</span>
                  </div>
                  <strong style={{ display: "block", marginTop: 10 }}>{id}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">升級規則</h2>
            <div className="rule-list" style={{ marginTop: 12 }}>
              {escalationRules.map(([label, action]) => (
                <div key={label} className="rule-item">
                  <strong>{label}</strong>
                  <p className="muted">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
