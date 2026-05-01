export const dynamic = "force-dynamic";

const funnelStages = [
  { stage: "點擊", value: "由 tracking_links / click_events 收集" },
  { stage: "名單", value: "POST /lead 收集表單" },
  { stage: "跟進", value: "LINE / Email 自動觸發" },
  { stage: "成交", value: "CRM deals 狀態追蹤" }
];

const ctaEffects = [
  ["限時優惠", "高轉換"],
  ["立即詢問", "中高轉換"],
  ["免費領取", "導流強"],
  ["先看案例", "信任建立"]
];

export default function FunnelCenterPage() {
  return (
    <div className="funnel-shell">
      <header className="funnel-hero">
        <h1>轉單中心</h1>
        <p className="muted">
          影片流量、導流連結、Landing Page、名單、跟進與成交，全部串成同一條漏斗。
        </p>
      </header>

      <section className="funnel-grid">
        {funnelStages.map((item, index) => (
          <article key={item.stage} className="funnel-card">
            <h2>{item.stage}</h2>
            <p className="muted">{item.value}</p>
            <div className={`stage-line ${index % 2 === 1 ? "alt" : ""}`} />
          </article>
        ))}
      </section>

      <section className="funnel-grid">
        <article className="funnel-card">
          <h2>名單管理</h2>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>來源</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["王小姐", "IG", "新名單"],
                  ["陳先生", "YouTube", "洽談中"],
                  ["林小姐", "Threads", "已聯絡"]
                ].map(([name, source, status]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{source}</td>
                    <td>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="funnel-card">
          <h2>成交管理</h2>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>案件</th>
                  <th>金額</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["保溫杯組合", "NT$3,200", "成交"],
                  ["課程名單", "NT$8,800", "洽談中"],
                  ["保養品套組", "NT$12,500", "已聯絡"]
                ].map(([name, amount, status]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{amount}</td>
                    <td>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="funnel-grid">
        <article className="funnel-card">
          <h2>導流來源分析</h2>
          <div className="tag-list">
            {["IG", "FB", "Threads", "YouTube"].map((item) => (
              <span key={item} className="tag">
                {item}
              </span>
            ))}
          </div>
          <p className="muted">追蹤每個短連結、來源平台、裝置、 IP 與轉換結果。</p>
        </article>

        <article className="funnel-card">
          <h2>CTA 效果分析</h2>
          <div className="list">
            {ctaEffects.map(([label, status]) => (
              <div key={label} className="list-item">
                <strong>{label}</strong>
                <p className="muted">{status}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="funnel-card">
          <h2>落地頁 A/B 測試</h2>
          <p className="muted">同商品可開多版本頁面，測試不同痛點、證據與 CTA 組合。</p>
          <div className="tag-list">
            {["版本 A", "版本 B", "版本 C"].map((variant) => (
              <span key={variant} className="tag">
                {variant}
              </span>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
