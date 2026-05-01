import Link from "next/link";

export const dynamic = "force-dynamic";

type AdminHomePageProps = {
  searchParams?: Promise<{ section?: string }>;
};

const overviewCards = [
  ["單一倉庫", "apps/admin-dashboard, apps/api, packages/ui, packages/config, packages/types, packages/utils"],
  ["AI 協調器", "prompt 控制、成本控制、風格控制、provider routing"],
  ["轉單閉環", "追蹤連結、Landing Page、名單表單、跟進、成交追蹤"],
  ["AI 客服中心", "對話引擎、意圖分類、lead 評分、知識庫、轉人工"],
  ["社群綁定", "Facebook、Instagram、Threads、YouTube 官方授權"]
];

const moduleCards = [
  ["內容模組", "content：標題、文案、腳本、hashtags"],
  ["影片模組", "video：腳本轉短影音、字幕、配音、BGM"],
  ["發布模組", "publishing：多平台發佈、排程、重試"],
  ["分析模組", "analytics：metrics、A/B test、優化建議"],
  ["轉單模組", "funnel：導流、表單、跟進、成交"],
  ["客服模組", "crm / chat：意圖、評分、接手、follow-up"]
];

const queueCards = [
  ["影片生成佇列", "負責渲染、TTS、字幕與輸出"],
  ["發布佇列", "負責排程、發佈與重試"],
  ["metrics 同步佇列", "負責拉取平台數據"],
  ["跟進佇列", "負責名單追問、售後與加購"]
];

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const params = (await searchParams) ?? {};
  const section = params.section ?? "overview";

  const isModules = section === "modules";
  const isQueues = section === "queues";
  const isOverview = !isModules && !isQueues;

  const cards = isModules ? moduleCards : isQueues ? queueCards : overviewCards;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h1 className="panel-title">核心架構總覽</h1>
              <p className="panel-desc">
                這是一個可插拔的 SaaS 核心骨架，內容、影片、發布、分析、轉單與客服模組都會共用同一層架構與資料契約。
              </p>
            </div>
            <div className="section-switcher">
              <Link className={`section-link ${isOverview ? "section-link-active" : ""}`} href="/">
                總覽
              </Link>
              <Link className={`section-link ${isModules ? "section-link-active" : ""}`} href="/?section=modules">
                核心模組
              </Link>
              <Link className={`section-link ${isQueues ? "section-link-active" : ""}`} href="/?section=queues">
                任務佇列
              </Link>
            </div>
          </div>
          <div className="badge-row" style={{ marginTop: 14 }}>
            <span className={`badge ${isOverview ? "danger" : ""}`}>總覽模式</span>
            <span className={`badge ${isModules ? "danger" : ""}`}>模組模式</span>
            <span className={`badge ${isQueues ? "danger" : ""}`}>佇列模式</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                {isModules ? "核心模組清單" : isQueues ? "任務佇列清單" : "架構重點"}
              </h2>
              <p className="panel-desc">
                {isModules
                  ? "點選 modules 後會直接看到各功能模組的切面。"
                  : isQueues
                    ? "點選 queues 後會直接看到各個背景任務。"
                    : "點選上方連結可切換核心模組與任務佇列。"}
              </p>
            </div>
          </div>

          <div className="grid">
            {cards.map(([title, desc]) => (
              <article key={title} className="card">
                <h2>{title}</h2>
                <p className="muted">{desc}</p>
                {title === "社群綁定" ? (
                  <Link className="card-link" href="/integrations">
                    前往綁定頁
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {isModules ? (
        <section className="panel">
          <div className="panel-inner">
            <h2 className="panel-title">模組導覽</h2>
            <p className="panel-desc">這裡可以直接跳到各個模組的開發入口。</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
