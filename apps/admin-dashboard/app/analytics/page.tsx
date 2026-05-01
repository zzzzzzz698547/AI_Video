export const dynamic = "force-dynamic";

const insightCards = [
  {
    title: "儀表板",
    description: "總曝光、總觀看、點擊、互動與成長趨勢會從真實 platform_metrics 與 daily_reports 匯入。"
  },
  {
    title: "內容排行榜",
    description: "依 score、CTR、完播率與互動率排序，直接找出高表現內容。"
  },
  {
    title: "A/B 測試",
    description: "同內容不同標題、封面、CTA 的勝出版本會自動回寫 optimization_rules。"
  },
  {
    title: "AI 優化建議",
    description: "系統會把最佳 Hook、CTA、長度、發文時間整理成可套用策略。"
  }
];

const platforms = ["Facebook", "Instagram", "Threads", "YouTube"];

export default function AnalyticsPage() {
  return (
    <div className="analytics-shell">
      <header className="panel">
        <h1>數據分析中心</h1>
        <p className="muted">
          這一層只吃真實 metrics，先分析，再回饋策略給 AI 內容與影片生成引擎。
        </p>
        <div className="pill-row" aria-label="platforms">
          {platforms.map((platform) => (
            <span key={platform} className="pill">
              {platform}
            </span>
          ))}
        </div>
      </header>

      <section className="stats-grid" aria-label="kpis">
        {["總曝光", "總觀看", "總點擊", "總互動", "平均完播率"].map((label) => (
          <article key={label} className="stat-card">
            <h3>{label}</h3>
            <div className="stat-value">待接資料</div>
            <p className="muted">顯示真實資料後，這裡會即時更新。</p>
          </article>
        ))}
      </section>

      <section className="analytics-grid">
        <article className="panel">
          <h2>成長趨勢圖</h2>
          <div className="chart-shell" aria-label="trend-chart">
            <div className="empty-state">折線圖 / 長條圖區塊，等 metrics 接入後再渲染真實走勢。</div>
          </div>
        </article>

        <article className="panel">
          <h2>平台比較</h2>
          <div className="chart-shell">
            <div className="bar-line" />
            <div className="bar-line alt" />
            <div className="bar-line" />
            <div className="bar-line alt" />
          </div>
          <p className="muted">平台排名與最佳內容類型會由分析引擎自動輸出。</p>
        </article>

        <article className="panel">
          <h2>發文時間熱力圖</h2>
          <div className="heatmap-shell" aria-label="heatmap">
            {Array.from({ length: 28 }).map((_, index) => (
              <span key={index} className="heatmap-cell" />
            ))}
          </div>
          <p className="muted">以真實發文時間與表現分數生成熱度分布。</p>
        </article>

        <article className="panel">
          <h2>AI 優化建議</h2>
          <div className="list">
            {insightCards.map((item) => (
              <div key={item.title} className="list-item">
                <h3>{item.title}</h3>
                <p className="muted">{item.description}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
