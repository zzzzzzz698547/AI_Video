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

const adminQuickLinks = [
  {
    href: "/integrations",
    title: "社群綁定中心",
    description: "檢查 Facebook / Instagram / Threads / YouTube 的授權、手動綁定與帳號狀態。"
  },
  {
    href: "/?section=modules",
    title: "核心模組檢查",
    description: "快速回到 content、video、publishing、analytics 等核心骨架，確認每個模組目前責任。"
  },
  {
    href: "/?section=queues",
    title: "任務佇列檢查",
    description: "查看影片生成、發布與數據同步的背景任務視角，方便排查部署後的卡點。"
  }
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
      <section className="panel hero-panel">
        <div className="panel-inner hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Admin Console</p>
            <h1 className="title">後台維運控制台</h1>
            <p className="subtle">
              這裡是管理員登入後的第一屏，現在會直接給你維運導覽、排查入口與架構摘要，方便快速切進需要處理的模組。
            </p>
            <div className="badge-row" style={{ marginTop: 18 }}>
              <span className="badge danger">管理員模式</span>
              <span className="badge">授權碼已略過</span>
              <span className="badge">多租戶 SaaS 維運中</span>
            </div>
          </div>

          <div className="hero-stack">
            {adminQuickLinks.map((item, index) => (
              <Link key={item.href} className="hero-action-card" href={item.href}>
                <div className="hero-action-index">0{index + 1}</div>
                <div>
                  <h2 className="hero-action-title">{item.title}</h2>
                  <p className="hero-action-copy">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
              <h2 className="panel-title">管理員今日操作焦點</h2>
              <p className="panel-desc">把最常用的維運節點直接放在首屏，不用先切頁也能知道該往哪裡進。</p>
            </div>
            <span className="badge danger">Ops</span>
          </div>

          <div className="grid">
            <article className="card">
              <h2>授權與帳號</h2>
              <p className="muted">優先檢查 OAuth callback、社群手動綁定與租戶授權狀態，避免客戶無法進站或發布。</p>
            </article>
            <article className="card">
              <h2>影片與發布</h2>
              <p className="muted">從影片生成到多平台發佈，這一段最容易受到 token、隊列與外部 API 狀態影響。</p>
            </article>
            <article className="card">
              <h2>資料與佇列</h2>
              <p className="muted">如果流程怪怪的，優先回頭看 Prisma、資料同步與背景任務，通常能很快抓到問題。</p>
            </article>
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
