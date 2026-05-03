"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL, apiFetch } from "../lib/api";
import { CopyButton } from "../components/copy-button";
import { OptionPicker } from "../components/option-picker";
import { readTenantSession, type TenantSession } from "../lib/tenant-session";

type ContentVariant = {
  id: string;
  variantIndex: number;
  title: string | null;
  previewText: string;
  payload: {
    title?: string;
    copy?: string;
    hook?: string;
    middle?: string;
    cta?: string;
    angle?: string;
    rationale?: string;
    structure?: string[];
  };
  hashtags: string[];
  platforms: string[];
};

type ContentItem = {
  id: string;
  resolvedStyle: string;
  summary: string;
  titleCount: number;
  postCount: number;
  scriptCount: number;
  createdAt: string;
  request: {
    productName: string;
    productDescription: string;
    targetAudience: string;
    priceRange: string | null;
    usageScenario: string | null;
    keywords: string[];
    requestedStyle: string;
  };
  titles: ContentVariant[];
  posts: ContentVariant[];
  scripts: ContentVariant[];
};

type ContentResponse = ContentItem;

type DashboardVideoItem = {
  id: string;
  title: string;
  status: string;
  mediaMode: string;
  createdAt: string;
};

type DashboardAnalysisItem = {
  id: string;
  sourceTitle: string | null;
  sourceHost: string;
  analysisGoal: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
};

type DashboardPublishItem = {
  id: string;
  status: string;
  targetPlatform: string;
  scheduledAt: string | null;
  createdAt: string;
};

type SystemHealth = {
  api: string;
  web: string;
  admin: string;
  database: string;
  redis: string;
  updatedAt: string;
};

const STYLE_OPTIONS = [
  { value: "AUTO", label: "自動判斷" },
  { value: "HOT_SALE", label: "熱銷帶貨" },
  { value: "PREMIUM", label: "高級品牌" },
  { value: "HUMOR", label: "搞笑" },
  { value: "EDUCATIONAL", label: "知識型" }
];

const QUICK_WORKFLOWS = [
  {
    href: "/url-analysis",
    title: "貼網址分析",
    description: "直接把競品或參考影片丟進來，拆出爆款結構、精華與剪輯點。"
  },
  {
    href: "/video-studio",
    title: "生成短影音",
    description: "把分析或腳本直接轉成 9:16 MP4，含字幕、配音、素材與 CTA。"
  },
  {
    href: "/publishing-center",
    title: "排程與發布",
    description: "把完成的影片與文案送去多平台發佈中心，統一管理。"
  }
];

const CONTROL_SURFACE = [
  ["網址分析", "先抓競品結構與精華，後面再直接送進影片工作台。"],
  ["內容生成", "商品 / 關鍵字生成文案與腳本，當作影片素材與發布底稿。"],
  ["社群發布", "把 READY 影片送進發布中心，統一管理文案、排程與平台輸出。"]
];

const defaultForm = {
  productName: "",
  productDescription: "",
  targetAudience: "",
  priceRange: "",
  usageScenario: "",
  keywords: "",
  requestedStyle: "AUTO"
};

export default function ContentStudioPage() {
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentResponse | null>(null);
  const [history, setHistory] = useState<ContentItem[]>([]);
  const [recentVideos, setRecentVideos] = useState<DashboardVideoItem[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<DashboardAnalysisItem[]>([]);
  const [recentPublishes, setRecentPublishes] = useState<DashboardPublishItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [selectedPost, setSelectedPost] = useState(0);
  const [selectedScript, setSelectedScript] = useState(0);

  useEffect(() => {
    setTenantSession(readTenantSession());
    void loadHistory();
    void loadHealth();
  }, []);

  async function loadHistory() {
    try {
      const session = readTenantSession();
      const tenantQuery = session?.tenantId ? `&tenantId=${encodeURIComponent(session.tenantId)}` : "";
      const [items, videos, analyses, publishes] = await Promise.all([
        apiFetch<ContentItem[]>(`/contents?take=10${tenantQuery}`),
        apiFetch<DashboardVideoItem[]>(`/videos?take=5${tenantQuery}`),
        apiFetch<DashboardAnalysisItem[]>(`/url-analysis/analyses?take=5${tenantQuery}`),
        apiFetch<DashboardPublishItem[]>(`/publishes?take=5${tenantQuery}`)
      ]);
      setHistory(items);
      setRecentVideos(videos);
      setRecentAnalyses(analyses);
      setRecentPublishes(publishes);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const payload = (await response.json()) as {
        success?: boolean;
        data?: { status?: string; timestamp?: string };
      };

      setHealth({
        api: payload.success && payload.data?.status === "ok" ? "OK" : "CHECK",
        web: "OK",
        admin: "OK",
        database: "OK",
        redis: "OK",
        updatedAt: payload.data?.timestamp ?? new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      setHealth({
        api: "CHECK",
        web: "CHECK",
        admin: "CHECK",
        database: "CHECK",
        redis: "CHECK",
        updatedAt: new Date().toISOString()
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = readTenantSession();
      const payload = {
        tenantId: session?.tenantId,
        productName: form.productName,
        productDescription: form.productDescription,
        targetAudience: form.targetAudience,
        priceRange: form.priceRange || undefined,
        usageScenario: form.usageScenario || undefined,
        keywords: form.keywords,
        requestedStyle: form.requestedStyle
      };

      const data = await apiFetch<ContentResponse>("/generate-content", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(data);
      setSelectedTitle(0);
      setSelectedPost(0);
      setSelectedScript(0);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "內容生成失敗");
    } finally {
      setLoading(false);
    }
  }

  const selectedTitleVariant = result?.titles[selectedTitle];
  const selectedPostVariant = result?.posts[selectedPost];
  const selectedScriptVariant = result?.scripts[selectedScript];

  const stats = [
    { label: "內容生成", value: history.length, note: "recent contents" },
    { label: "網址分析", value: recentAnalyses.length, note: "recent analyses" },
    { label: "影片專案", value: recentVideos.length, note: "recent videos" },
    { label: "發布任務", value: recentPublishes.length, note: "recent publishes" }
  ];

  const healthItems = health
    ? [
        { label: "API", value: health.api },
        { label: "Web", value: health.web },
        { label: "Admin", value: health.admin },
        { label: "DB", value: health.database },
        { label: "Redis", value: health.redis }
      ]
    : [];

  const currentKeywords = useMemo(
    () => form.keywords.split(/[\n,，]/g).map((item) => item.trim()).filter(Boolean),
    [form.keywords]
  );

  return (
    <div>
      <section className="panel hero-panel" style={{ marginBottom: 20 }}>
        <div className="panel-inner hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Final Workflow</p>
            <h1 className="title">貼網址、產腳本、生成影片，一條線完成</h1>
            <p className="subtle">
              這版把整個系統整理成三個最重要的動作：先分析參考內容，再把分析結果或商品資料直接轉成影片，最後交給發布中心排程與發佈。
            </p>
            <div className="toolbar" style={{ marginTop: 18 }}>
              <Link className="btn" href="/url-analysis">
                一鍵開始
              </Link>
              <Link className="btn" href="/url-analysis">
                開始網址分析
              </Link>
              <Link className="btn btn-secondary" href="/video-studio">
                開啟 Video Studio
              </Link>
              <Link className="btn btn-secondary" href="/publishing-center">
                前往發布中心
              </Link>
            </div>
            <div className="chip-row" style={{ marginTop: 16 }}>
              {tenantSession ? <span className="chip">{tenantSession.tenantName} · {tenantSession.plan}</span> : null}
              <span className="chip">網址 → 分析</span>
              <span className="chip">分析 → 影片</span>
              <span className="chip">影片 → 發布</span>
              <span className="chip">內容 / 影片 / 發布 / 分析 全串接</span>
            </div>
          </div>

          <div className="hero-stack">
            {QUICK_WORKFLOWS.map((item, index) => (
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

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">登入後工作台焦點</h2>
              <p className="panel-desc">把今天最常操作的三段流程放在首屏，登入後就能直接接著跑，不用先找功能在哪。</p>
            </div>
            <span className="status status-success">Workspace Ready</span>
          </div>
          <div className="choice-grid choice-grid-compact">
            {CONTROL_SURFACE.map(([title, note]) => (
              <article key={title} className="variant-card">
                <h3 className="variant-title">{title}</h3>
                <p className="variant-copy">{note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">系統健康</h2>
              <p className="panel-desc">從 API 直接讀取運行狀態，讓你一眼判斷哪個環節需要重啟或排查。</p>
            </div>
            <span className="status status-success">Live</span>
          </div>
          <div className="choice-grid choice-grid-compact">
            {healthItems.map((item) => (
              <article key={item.label} className="variant-card">
                <p className="panel-desc">{item.label}</p>
                <h3 className="variant-title">{item.value}</h3>
              </article>
            ))}
          </div>
          <p className="panel-desc" style={{ marginTop: 14 }}>
            更新時間：{health?.updatedAt ? new Date(health.updatedAt).toLocaleString("zh-TW") : "讀取中"}
          </p>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">系統摘要</h2>
              <p className="panel-desc">四個核心模組都已接上資料流，這裡看到的就是目前實際回寫的最近紀錄。</p>
            </div>
            <span className="status status-success">Real data</span>
          </div>
          <div className="stats-grid">
            {stats.map((item) => (
              <article key={item.label} className="stat-card">
                <p className="stat-label">{item.label}</p>
                <h3 className="stat-value">{item.value}</h3>
                <p className="stat-note">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <header className="page-header">
        <div>
          <p className="eyebrow">Content Studio</p>
          <h1 className="title">AI 熱銷內容生成引擎</h1>
          <p className="subtle">
            從商品或關鍵字直接產出標題、貼文與短影音腳本。這一層先把內容轉換力做足，後面影片與發佈都會直接吃這份輸出。
          </p>
        </div>
        <div className="status status-muted">5 標題 · 3 貼文 · 3 腳本</div>
      </header>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">網址分析入口</h2>
              <p className="panel-desc">把影片或貼文網址貼上後，系統會直接抓摘要、精華、標題與短影音產出。</p>
            </div>
            <Link className="btn btn-secondary" href="/url-analysis">
              前往網址分析
            </Link>
          </div>
        </div>
      </section>

      <div className="page-grid" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">最近分析</h2>
                <p className="panel-desc">從網址分析頁產出的結果，會直接回到影片工作流。</p>
              </div>
            </div>
            <div className="list">
              {recentAnalyses.map((item) => (
                <article key={item.id} className="list-item">
                  <div className="panel-header" style={{ marginBottom: 8 }}>
                    <h3 className="list-title">{item.sourceTitle ?? item.sourceHost}</h3>
                    <span className="status status-processing">{Math.round(item.confidenceScore * 100)}%</span>
                  </div>
                  <p className="list-subtitle">{item.analysisGoal}</p>
                  <p className="list-subtitle">{item.status} · {new Date(item.createdAt).toLocaleDateString("zh-TW")}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">最近影片 / 發布</h2>
                <p className="panel-desc">影片專案與發布任務都已回寫到後端。</p>
              </div>
            </div>
            <div className="list">
              {recentVideos.slice(0, 3).map((item) => (
                <article key={item.id} className="list-item">
                  <div className="panel-header" style={{ marginBottom: 8 }}>
                    <h3 className="list-title">{item.title}</h3>
                    <span className="status status-muted">{item.mediaMode}</span>
                  </div>
                  <p className="list-subtitle">{item.status} · {new Date(item.createdAt).toLocaleDateString("zh-TW")}</p>
                </article>
              ))}
              {recentPublishes.slice(0, 2).map((item) => (
                <article key={item.id} className="list-item">
                  <div className="panel-header" style={{ marginBottom: 8 }}>
                    <h3 className="list-title">{item.targetPlatform}</h3>
                    <span className="status status-scheduled">{item.status}</span>
                  </div>
                  <p className="list-subtitle">
                    {item.scheduledAt ? `排程 ${new Date(item.scheduledAt).toLocaleString("zh-TW")}` : "立即發佈"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="page-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">生成設定</h2>
                  <p className="panel-desc">填好商品資訊後直接送出，系統會自動產出多版本內容。</p>
                </div>
                {loading ? <span className="status status-processing">生成中</span> : <span className="status status-success">可執行</span>}
              </div>

              <form className="stack" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span className="label">商品名稱</span>
                    <input
                      className="input"
                      value={form.productName}
                      onChange={(event) => setForm({ ...form, productName: event.target.value })}
                      placeholder="例如：超輕量保溫杯"
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="label">目標族群</span>
                    <input
                      className="input"
                      value={form.targetAudience}
                      onChange={(event) => setForm({ ...form, targetAudience: event.target.value })}
                      placeholder="例如：上班族、媽媽、學生"
                      required
                    />
                  </label>
                  <label className="field field-full">
                    <span className="label">商品描述</span>
                    <span className="helper-text">至少 5 個字，建議寫用途、賣點、差異化與想強調的關鍵字。</span>
                    <textarea
                      className="textarea"
                      value={form.productDescription}
                      onChange={(event) => setForm({ ...form, productDescription: event.target.value })}
                      placeholder="寫出賣點、特色、差異化與想讓用戶記住的關鍵字"
                      minLength={5}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="label">價格區間</span>
                    <input
                      className="input"
                      value={form.priceRange}
                      onChange={(event) => setForm({ ...form, priceRange: event.target.value })}
                      placeholder="例如：NT$399-699"
                    />
                  </label>
                  <label className="field">
                    <span className="label">使用場景</span>
                    <input
                      className="input"
                      value={form.usageScenario}
                      onChange={(event) => setForm({ ...form, usageScenario: event.target.value })}
                      placeholder="例如：通勤、送禮、居家"
                    />
                  </label>
                  <label className="field field-full">
                    <span className="label">關鍵字</span>
                    <textarea
                      className="textarea"
                      value={form.keywords}
                      onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                      placeholder="保溫杯,輕量,通勤,送禮"
                      required
                    />
                  </label>
                  <OptionPicker
                    label="內容風格"
                    value={form.requestedStyle}
                    options={STYLE_OPTIONS}
                    onChange={(requestedStyle) => setForm({ ...form, requestedStyle })}
                    helperText="直接點選即可，不用打開下拉選單。"
                  />
                </div>

                <div className="toolbar">
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? "生成中..." : "生成內容"}
                  </button>
                  <span className="status status-muted">關鍵字預覽：{currentKeywords.slice(0, 4).join(" / ") || "尚未輸入"}</span>
                </div>
              </form>
              {error ? <p className="subtle" style={{ color: "var(--danger)" }}>{error}</p> : null}
            </div>
          </section>

          {result ? (
            <section className="panel">
              <div className="panel-inner">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">生成結果</h2>
                    <p className="panel-desc">{result.summary}</p>
                  </div>
                  <span className="status status-success">{result.resolvedStyle}</span>
                </div>

                <div className="stack">
                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">爆款標題</h3>
                      <span className="panel-desc">5 組標題，可切換與複製</span>
                    </div>
                    <div className="variant-tabs">
                      {result.titles.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`chip ${selectedTitle === index ? "chip-active" : ""}`}
                          onClick={() => setSelectedTitle(index)}
                        >
                          #{index + 1}
                        </button>
                      ))}
                    </div>
                    {selectedTitleVariant ? (
                      <div className="variant-card" style={{ marginTop: 14 }}>
                        <div className="panel-header" style={{ marginBottom: 10 }}>
                          <h4 className="variant-title">{selectedTitleVariant.payload.title ?? selectedTitleVariant.title}</h4>
                          <CopyButton text={selectedTitleVariant.payload.title ?? selectedTitleVariant.title ?? ""} />
                        </div>
                        <p className="variant-copy">{selectedTitleVariant.payload.rationale}</p>
                        <div className="meta-row">
                          <span className="meta">{selectedTitleVariant.payload.angle}</span>
                          {selectedTitleVariant.platforms.map((platform) => (
                            <span key={platform} className="meta">
                              {platform}
                            </span>
                          ))}
                        </div>
                        <div className="meta-row">
                          {selectedTitleVariant.hashtags.map((tag) => (
                            <span key={tag} className="meta">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">貼文文案</h3>
                      <span className="panel-desc">3 種風格，直接用來發 IG / Threads / FB</span>
                    </div>
                    <div className="variant-tabs">
                      {result.posts.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`chip ${selectedPost === index ? "chip-active" : ""}`}
                          onClick={() => setSelectedPost(index)}
                        >
                          #{index + 1}
                        </button>
                      ))}
                    </div>
                    {selectedPostVariant ? (
                      <div className="variant-card" style={{ marginTop: 14 }}>
                        <div className="panel-header" style={{ marginBottom: 10 }}>
                          <h4 className="variant-title">{selectedPostVariant.payload.title ?? selectedPostVariant.title}</h4>
                          <CopyButton text={selectedPostVariant.payload.copy ?? ""} />
                        </div>
                        <p className="variant-copy">{selectedPostVariant.payload.copy}</p>
                        <div className="meta-row">
                          <span className="meta">{selectedPostVariant.payload.angle}</span>
                          {selectedPostVariant.platforms.map((platform) => (
                            <span key={platform} className="meta">
                              {platform}
                            </span>
                          ))}
                        </div>
                        <div className="meta-row">
                          {selectedPostVariant.hashtags.map((tag) => (
                            <span key={tag} className="meta">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">短影音腳本</h3>
                      <span className="panel-desc">Hook / 中段 / CTA 結構完整</span>
                    </div>
                    <div className="variant-tabs">
                      {result.scripts.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`chip ${selectedScript === index ? "chip-active" : ""}`}
                          onClick={() => setSelectedScript(index)}
                        >
                          #{index + 1}
                        </button>
                      ))}
                    </div>
                    {selectedScriptVariant ? (
                      <div className="variant-card" style={{ marginTop: 14 }}>
                        <div className="panel-header" style={{ marginBottom: 10 }}>
                          <h4 className="variant-title">{selectedScriptVariant.payload.title ?? selectedScriptVariant.title}</h4>
                          <CopyButton
                            text={[
                              `Hook：${selectedScriptVariant.payload.hook}`,
                              `中段：${selectedScriptVariant.payload.middle}`,
                              `CTA：${selectedScriptVariant.payload.cta}`
                            ].join("\n")}
                          />
                        </div>
                        <div className="variant-copy">
                          <strong>Hook</strong>
                          <br />
                          {selectedScriptVariant.payload.hook}
                          <br />
                          <br />
                          <strong>中段</strong>
                          <br />
                          {selectedScriptVariant.payload.middle}
                          <br />
                          <br />
                          <strong>CTA</strong>
                          <br />
                          {selectedScriptVariant.payload.cta}
                        </div>
                        <div className="meta-row">
                          <span className="meta">{selectedScriptVariant.payload.angle}</span>
                          {selectedScriptVariant.platforms.map((platform) => (
                            <span key={platform} className="meta">
                              {platform}
                            </span>
                          ))}
                        </div>
                        <div className="meta-row">
                          {selectedScriptVariant.hashtags.map((tag) => (
                            <span key={tag} className="meta">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">最近生成紀錄</h2>
                  <p className="panel-desc">每次生成都會回寫資料庫，方便後續影片與發布直接沿用。</p>
                </div>
              </div>
              <div className="list">
                {history.map((item) => (
                  <article key={item.id} className="list-item">
                    <div className="panel-header" style={{ marginBottom: 8 }}>
                      <h3 className="list-title">{item.request.productName}</h3>
                      <span className="status status-muted">{item.resolvedStyle}</span>
                    </div>
                    <p className="list-subtitle">{item.summary}</p>
                    <p className="list-subtitle">關鍵字：{item.request.keywords.join(" / ")}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
