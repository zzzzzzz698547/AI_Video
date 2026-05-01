export const dynamic = "force-dynamic";

const articles = [
  ["商品資料", "18 篇"],
  ["FAQ", "42 則"],
  ["品牌話術", "26 組"],
  ["禁止承諾", "12 條"]
];

const faqs = [
  ["有沒有現貨？", "依庫存回覆，避免寫死承諾。"],
  ["多久到貨？", "先根據官方可配送範圍與物流方式回覆。"],
  ["怎麼付款？", "整理付款方式與安全提示。"]
];

export default function KnowledgeBasePage() {
  return (
    <div className="chat-shell">
      <header className="chat-hero">
        <p className="eyebrow">知識庫管理</p>
        <h1 className="title">知識庫管理</h1>
        <p className="subtle">FAQ、商品資訊、品牌語氣與禁止承諾都在這裡維護，AI 回答時會優先查詢這一層。</p>
      </header>

      <section className="chat-grid">
        {articles.map(([label, value]) => (
          <article key={label} className="card">
            <p className="muted">{label}</p>
            <h2>{value}</h2>
          </article>
        ))}
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">常見問題</h2>
            <div className="rule-list" style={{ marginTop: 12 }}>
              {faqs.map(([question, answer]) => (
                <div key={question} className="rule-item">
                  <strong>{question}</strong>
                  <p className="muted">{answer}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">品牌話術與禁用詞</h2>
            <div className="badge-row" style={{ marginTop: 12 }}>
              {["專業型", "高級感", "親切型", "熱銷帶貨型"].map((item) => (
                <span key={item} className="badge">
                  {item}
                </span>
              ))}
              {["不保證庫存", "不亂報價", "不誇大療效", "不可過度推銷"].map((item) => (
                <span key={item} className="badge warn">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
