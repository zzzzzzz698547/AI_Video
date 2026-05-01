export const dynamic = "force-dynamic";

const rules = [
  ["未回覆 2 小時", "追問一次"],
  ["高意向名單", "提醒真人接手"],
  ["成交後 3 天", "售後關懷"],
  ["成交後 7 天", "加購提醒"]
];

const jobs = [
  ["#job-2001", "PENDING", "LINE"],
  ["#job-2002", "RUNNING", "EMAIL"],
  ["#job-2003", "PENDING", "WEBHOOK"]
];

export default function FollowUpPage() {
  return (
    <div className="chat-shell">
      <header className="chat-hero">
        <p className="eyebrow">自動跟進</p>
        <h1 className="title">自動跟進設定</h1>
        <p className="subtle">把沒成交的名單繼續養，根據階段、熱度與事件自動排程訊息。</p>
      </header>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">規則</h2>
            <div className="rule-list" style={{ marginTop: 12 }}>
              {rules.map(([label, action]) => (
                <div key={label} className="rule-item">
                  <strong>{label}</strong>
                  <p className="muted">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">排程任務</h2>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>任務</th>
                    <th>狀態</th>
                    <th>渠道</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(([id, status, channel]) => (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>{status}</td>
                      <td>{channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
