"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { apiFetch } from "../../lib/api";
import { CopyButton } from "../../components/copy-button";
import { OptionPicker } from "../../components/option-picker";
import { readTenantSession, type TenantSession } from "../../lib/tenant-session";

type UrlAnalysisVariantType = "TITLE" | "HIGHLIGHT" | "SCRIPT" | "CUT_PLAN";

type UrlAnalysisVariant = {
  id: string;
  variantType: UrlAnalysisVariantType;
  variantIndex: number;
  title: string | null;
  previewText: string;
  payload: {
    title?: string;
    copy?: string;
    hook?: string;
    middle?: string;
    cta?: string;
    rationale?: string;
    angle?: string;
    structure?: string[];
    reason?: string;
    visualSuggestion?: string;
    startHint?: string;
    endHint?: string;
    titleHint?: string;
  };
  hashtags: string[];
  platforms: string[];
};

type UrlAnalysisResult = {
  id: string;
  requestId: string;
  status: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceDescription: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  targetAudience: string | null;
  desiredTone: string | null;
  desiredLengthSeconds: number;
  focusKeywords: string[];
  topic: string;
  summary: string;
  keyTakeaways: string[];
  highlightMoments: Array<{
    title: string;
    reason: string;
    visualSuggestion: string;
    startHint: string;
    endHint: string;
    quote?: string | null;
  }>;
  suggestedCuts: Array<{
    title: string;
    description: string;
    startHint: string;
    endHint: string;
    angle: string;
  }>;
  recommendedPlatforms: string[];
  recommendedLengthSeconds: number;
  recommendedHook: string;
  recommendedCTA: string;
  confidenceScore: number;
  variants: UrlAnalysisVariant[];
  createdAt: string;
  updatedAt: string;
};

type AnalysisListItem = {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: string;
  sourceTitle: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  status: string;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

type UrlVerificationResult = {
  verified: boolean;
  normalizedUrl: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceDescription: string | null;
  sourceImage: string | null;
  confidence: number;
  message: string;
};

const MODE_OPTIONS = [
  { value: "精華剪輯", label: "精華剪輯", description: "快速抓亮點與可剪片段" },
  { value: "標題優化", label: "標題優化", description: "專注點擊率與爆款標題" },
  { value: "腳本產出", label: "腳本產出", description: "直接產出可拍可剪的腳本" },
  { value: "轉換導向", label: "轉換導向", description: "把內容改成能導流成交" }
];

const TONE_OPTIONS = [
  { value: "專業型", label: "專業型", description: "偏分析與解說" },
  { value: "高級感", label: "高級感", description: "偏品牌與質感" },
  { value: "親切型", label: "親切型", description: "偏自然對話" },
  { value: "熱銷帶貨型", label: "熱銷帶貨型", description: "偏轉換與成交" }
];

const LENGTH_OPTIONS = [
  { value: "15", label: "15 秒", description: "更快切重點" },
  { value: "30", label: "30 秒", description: "保留較完整脈絡" }
];

const defaultForm = {
  url: "",
  analysisGoal: "分析這支影片的精華並產出可發布內容",
  analysisMode: "精華剪輯",
  targetAudience: "",
  desiredTone: "親切型",
  desiredLengthSeconds: "30",
  focusKeywords: "",
  workspaceId: "",
  brandId: ""
};

const variantTabs: Array<{ value: UrlAnalysisVariantType; label: string }> = [
  { value: "TITLE", label: "爆款標題" },
  { value: "HIGHLIGHT", label: "精華亮點" },
  { value: "SCRIPT", label: "腳本產出" },
  { value: "CUT_PLAN", label: "切點建議" }
];

const ANALYSIS_STEPS = [
  { label: "建立任務", progress: 12 },
  { label: "抓取來源", progress: 28 },
  { label: "AI 摘要", progress: 52 },
  { label: "亮點與切點", progress: 76 },
  { label: "完成輸出", progress: 100 }
];

export default function UrlAnalysisPage() {
  const router = useRouter();
  const autoRedirectTimerRef = useRef<number | null>(null);
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("待開始");
  const [analysisStepIndex, setAnalysisStepIndex] = useState(-1);
  const [liveSummary, setLiveSummary] = useState<string>("等待輸入網址");
  const [liveHook, setLiveHook] = useState<string>("先貼上網址，AI 會抓出最強開頭");
  const [liveCTA, setLiveCTA] = useState<string>("分析完成後會自動整理成可直接發佈的版本");
  const [result, setResult] = useState<UrlAnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<UrlVerificationResult | null>(null);
  const [selectedVariantType, setSelectedVariantType] = useState<UrlAnalysisVariantType>("TITLE");

  useEffect(() => {
    const session = readTenantSession();
    setTenantSession(session);
    if (session) {
      setForm((current) => ({
        ...current,
        workspaceId: current.workspaceId || session.workspaceId
      }));
    }
    void loadHistory();
  }, []);

  useEffect(() => {
    return () => {
      if (autoRedirectTimerRef.current) {
        window.clearTimeout(autoRedirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setAnalysisStepIndex(result ? ANALYSIS_STEPS.length - 1 : -1);
      return undefined;
    }

    setAnalysisProgress(12);
    setAnalysisStage("建立分析任務");
    setAnalysisStepIndex(0);
    setLiveSummary("AI 會先讀取來源標題、摘要與關鍵字，準備拆解內容結構。");
    setLiveHook("建立任務後，系統會先抓出最值得下鉤的開場段落。");
    setLiveCTA("完成後會直接送到影片生成工作台。");

    const steps = [
      { delay: 350, progress: ANALYSIS_STEPS[1].progress, stage: ANALYSIS_STEPS[1].label, index: 1 },
      { delay: 1100, progress: ANALYSIS_STEPS[2].progress, stage: ANALYSIS_STEPS[2].label, index: 2 },
      { delay: 2200, progress: ANALYSIS_STEPS[3].progress, stage: ANALYSIS_STEPS[3].label, index: 3 },
      { delay: 3400, progress: 96, stage: ANALYSIS_STEPS[4].label, index: 4 }
    ];

    const timers = steps.map((step) =>
      window.setTimeout(() => {
        setAnalysisProgress((current) => Math.max(current, step.progress));
        setAnalysisStage(step.stage);
        setAnalysisStepIndex(step.index);

        if (step.index === 1) {
          setLiveSummary("正在抓取來源資訊與結構，AI 會根據標題、描述與目標族群整理主題輪廓。");
        } else if (step.index === 2) {
          setLiveSummary("AI 正在濃縮內容重點，並找出能吸引用戶的第一個爆點。");
          setLiveHook("這一段通常會是最適合做短影音開頭的地方。");
        } else if (step.index === 3) {
          setLiveSummary("AI 正在整理亮點、切點與可直接剪輯的時間節點。");
          setLiveCTA("完成後可直接進入影片工作台產出成片。");
        } else if (step.index === 4) {
          setLiveSummary("分析已完成，系統已準備好送往影片生成流程。");
        }
      }, step.delay)
    );

    const drip = window.setInterval(() => {
      setAnalysisProgress((current) => (current < 90 ? Math.min(current + 2, 90) : current));
    }, 220);

    return () => {
      window.clearInterval(drip);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [loading, result]);

  async function loadHistory() {
    try {
      const session = readTenantSession();
      const tenantQuery = session?.tenantId ? `&tenantId=${encodeURIComponent(session.tenantId)}` : "";
      const items = await apiFetch<AnalysisListItem[]>(`/url-analysis/analyses?take=10${tenantQuery}`);
      setHistory(items);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setAnalysisProgress(0);
    setAnalysisStage("準備分析...");
    setError(null);

    try {
      const payload = {
        tenantId: tenantSession?.tenantId,
        url: form.url,
        analysisGoal: form.analysisGoal,
        analysisMode: form.analysisMode || undefined,
        targetAudience: form.targetAudience || undefined,
        desiredTone: form.desiredTone || undefined,
        desiredLengthSeconds: Number(form.desiredLengthSeconds) as 15 | 30,
        focusKeywords: form.focusKeywords,
        workspaceId: form.workspaceId || tenantSession?.workspaceId || undefined,
        brandId: form.brandId || undefined
      };

      const data = await apiFetch<UrlAnalysisResult>("/url-analysis/analyze", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(data);
      setAnalysisProgress(100);
      setAnalysisStage("分析完成");
      setAnalysisStepIndex(ANALYSIS_STEPS.length - 1);
      setSelectedVariantType("TITLE");
      setLiveSummary(data.summary);
      setLiveHook(data.recommendedHook);
      setLiveCTA(data.recommendedCTA);
      await loadHistory();

      if (autoRedirectTimerRef.current) {
        window.clearTimeout(autoRedirectTimerRef.current);
      }
      autoRedirectTimerRef.current = window.setTimeout(() => {
        router.push(`/video-studio?analysisId=${encodeURIComponent(data.requestId)}`);
      }, 1800);
    } catch (err) {
      setAnalysisProgress(0);
      setAnalysisStage("分析失敗");
      setAnalysisStepIndex(-1);
      setLiveSummary("分析失敗，請檢查網址或稍後再試。");
      setLiveHook("若是來源頁面限制，可改貼 YouTube 或一般公開網址。");
      setLiveCTA("確認後重新開始分析。");
      setError(err instanceof Error ? err.message : "網址分析失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!form.url.trim()) {
      setVerifyMessage("請先輸入網址");
      setVerification(null);
      return;
    }

    setVerifying(true);
    setVerifyMessage(null);
    try {
      const data = await apiFetch<UrlVerificationResult>("/url-analysis/verify", {
        method: "POST",
        body: JSON.stringify({ url: form.url })
      });

      setVerification(data);
      setVerifyMessage(data.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "驗證失敗";
      setVerification(null);
      setVerifyMessage(message);
    } finally {
      setVerifying(false);
    }
  }

  const currentStep = ANALYSIS_STEPS[Math.max(analysisStepIndex, 0)] ?? ANALYSIS_STEPS[0];

  const groupedVariants = useMemo(() => {
    if (!result) return [];
    return variantTabs.map((tab) => ({
      ...tab,
      items: result.variants.filter((variant) => variant.variantType === tab.value)
    }));
  }, [result]);

  const currentGroup = groupedVariants.find((group) => group.value === selectedVariantType) ?? groupedVariants[0];
  const videoStudioHref = result ? `/video-studio?analysisId=${encodeURIComponent(result.requestId)}` : "/video-studio";

  return (
    <div>
      <header className="page-header">
            <div>
              <p className="eyebrow">URL Analysis</p>
              <h1 className="title">貼網址就能分析精華並產出</h1>
          <p className="subtle">
            貼上 YouTube、TikTok、IG、FB 或一般網頁網址，系統會自動抓標題、摘要、精華切點，並直接產出爆款標題與腳本。
          </p>
            </div>
            {tenantSession ? <div className="status status-muted">{tenantSession.tenantName} · {tenantSession.workspaceName}</div> : null}
        <div className="status status-processing">URL · 精華 · 標題 · 腳本</div>
      </header>

      <div className="page-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">網址分析設定</h2>
                  <p className="panel-desc">先貼網址，再指定你要的分析角度，系統會直接把重點整理成可發佈內容。</p>
                </div>
                {loading ? <span className="status status-processing">分析中</span> : <span className="status status-success">可分析</span>}
              </div>

              <form className="stack" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <label className="field field-full">
                    <span className="label">影片或網頁網址</span>
                    <div className="url-verify-row">
                      <input
                        className="input"
                        value={form.url}
                        onChange={(event) => {
                          setForm({ ...form, url: event.target.value });
                          setVerification(null);
                          setVerifyMessage(null);
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        required
                      />
                      <button
                        className="btn btn-secondary url-verify-button"
                        type="button"
                        onClick={() => void handleVerify()}
                        disabled={verifying || !form.url.trim()}
                      >
                        {verifying ? "驗證中..." : "驗證"}
                      </button>
                    </div>
                    <div className="toolbar" style={{ marginTop: 6, justifyContent: "space-between" }}>
                      <span className={`status ${verification?.verified ? "status-success" : "status-muted"}`}>
                        {verification?.verified ? "已確認讀取" : "尚未驗證"}
                      </span>
                      {verifyMessage ? <span className="status status-processing">{verifyMessage}</span> : null}
                    </div>
                  </label>

                  {verification ? (
                    <article className="url-preview-card field field-full">
                      <div className="url-preview-cover">
                        {verification.sourceImage ? (
                          <img
                            src={verification.sourceImage}
                            alt={verification.sourceTitle ?? verification.sourceHost}
                            className="url-preview-image"
                          />
                        ) : (
                          <div className="url-preview-placeholder">
                            <span>無封面預覽</span>
                          </div>
                        )}
                      </div>
                      <div className="url-preview-body">
                        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p className="panel-desc">來源預覽</p>
                            <h3 className="variant-title">{verification.sourceTitle ?? verification.sourceHost}</h3>
                          </div>
                          <span className="status status-success">已確認讀取</span>
                        </div>
                        <p className="variant-copy" style={{ marginTop: 8 }}>
                          {verification.sourceDescription ?? verification.normalizedUrl}
                        </p>
                        <div className="chip-row" style={{ marginTop: 12 }}>
                          <span className="chip">{verification.sourceHost}</span>
                          <span className="chip">{verification.sourceType}</span>
                          <span className="chip">{Math.round(verification.confidence * 100)}%</span>
                        </div>
                      </div>
                    </article>
                  ) : null}

                  <label className="field field-full">
                    <span className="label">分析目標</span>
                    <textarea
                      className="textarea"
                      value={form.analysisGoal}
                      onChange={(event) => setForm({ ...form, analysisGoal: event.target.value })}
                      placeholder="例如：分析精華、拆成短影音腳本、抓標題靈感"
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="label">目標族群</span>
                    <input
                      className="input"
                      value={form.targetAudience}
                      onChange={(event) => setForm({ ...form, targetAudience: event.target.value })}
                      placeholder="例如：上班族 / 想帶貨的創作者"
                    />
                  </label>

                  <OptionPicker
                    label="分析模式"
                    value={form.analysisMode}
                    options={MODE_OPTIONS}
                    onChange={(analysisMode) => setForm({ ...form, analysisMode })}
                    compact
                  />

                  <OptionPicker
                    label="內容語氣"
                    value={form.desiredTone}
                    options={TONE_OPTIONS}
                    onChange={(desiredTone) => setForm({ ...form, desiredTone })}
                    compact
                  />

                  <OptionPicker
                    label="輸出長度"
                    value={form.desiredLengthSeconds}
                    options={LENGTH_OPTIONS}
                    onChange={(desiredLengthSeconds) => setForm({ ...form, desiredLengthSeconds })}
                    compact
                  />

                  <label className="field field-full">
                    <span className="label">關鍵字</span>
                    <textarea
                      className="textarea"
                      value={form.focusKeywords}
                      onChange={(event) => setForm({ ...form, focusKeywords: event.target.value })}
                      placeholder="爆款,精華,短影音,標題,CTA"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Workspace ID（可留空）</span>
                    <input
                      className="input"
                      value={form.workspaceId}
                      onChange={(event) => setForm({ ...form, workspaceId: event.target.value })}
                      placeholder="demo-workspace"
                    />
                  </label>

                  <label className="field">
                    <span className="label">Brand ID（可留空）</span>
                    <input
                      className="input"
                      value={form.brandId}
                      onChange={(event) => setForm({ ...form, brandId: event.target.value })}
                      placeholder="demo-brand"
                    />
                  </label>
                </div>

                <div className="toolbar">
                  <button className="btn" type="submit" disabled={loading}>
                    {loading ? `分析中 ${analysisProgress}%` : "開始分析"}
                  </button>
                  <span className="status status-muted">會自動抓標題、摘要、亮點與短影音版本</span>
                </div>

                {loading || analysisProgress > 0 ? (
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="toolbar" style={{ justifyContent: "space-between" }}>
                      <span className="status status-processing">{analysisStage}</span>
                      <span className="status status-muted">{analysisProgress}%</span>
                    </div>
                    <div className="analysis-stepper" aria-label="analysis steps">
                      {ANALYSIS_STEPS.map((step, index) => {
                        const isDone = analysisStepIndex > index || analysisProgress === 100;
                        const isActive = analysisStepIndex === index && analysisProgress < 100;

                        return (
                          <div
                            key={step.label}
                            className={`analysis-step ${isDone ? "analysis-step-done" : ""} ${isActive ? "analysis-step-active" : ""}`}
                          >
                            <span className="analysis-step-index">{isDone ? "✓" : index + 1}</span>
                            <span className="analysis-step-label">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="progress" aria-label="analysis progress">
                      <span style={{ width: `${analysisProgress}%` }} />
                    </div>
                  </div>
                ) : null}
              </form>

              <div className="analysis-sidecard">
                <div className="panel-header" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 className="panel-title">當前分析步驟</h3>
                    <p className="panel-desc">左側即時顯示流程，方便你知道現在跑到哪一步。</p>
                  </div>
                  <span className="status status-processing">{currentStep.label}</span>
                </div>
                <div className="analysis-stepper analysis-stepper-vertical" aria-label="analysis steps sidebar">
                  {ANALYSIS_STEPS.map((step, index) => {
                    const isDone = analysisStepIndex > index || analysisProgress === 100;
                    const isActive = analysisStepIndex === index && analysisProgress < 100;

                    return (
                      <div
                        key={step.label}
                        className={`analysis-step ${isDone ? "analysis-step-done" : ""} ${isActive ? "analysis-step-active" : ""}`}
                      >
                        <span className="analysis-step-index">{isDone ? "✓" : index + 1}</span>
                        <span className="analysis-step-label">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {error ? <p className="subtle" style={{ color: "var(--danger)" }}>{error}</p> : null}
            </div>
          </section>

          {result ? (
            <section className="panel">
              <div className="panel-inner">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">分析結果</h2>
                    <p className="panel-desc">{result.summary}</p>
                  </div>
                  <div className="toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="status status-success">{Math.round(result.confidenceScore * 100)}% confidence</span>
                    <Link className="btn btn-secondary" href={videoStudioHref}>
                      送去影片生成
                    </Link>
                  </div>
                </div>

                <div className="choice-grid" style={{ marginBottom: 18 }}>
                  <article className="variant-card">
                    <p className="panel-desc">來源</p>
                    <h3 className="variant-title">{result.sourceTitle ?? result.sourceHost}</h3>
                    <p className="variant-copy">{result.sourceType}</p>
                  </article>
                  <article className="variant-card">
                    <p className="panel-desc">建議平台</p>
                    <h3 className="variant-title">{result.recommendedPlatforms.join(" / ")}</h3>
                    <p className="variant-copy">適合 {result.recommendedLengthSeconds} 秒版本</p>
                  </article>
                  <article className="variant-card">
                    <p className="panel-desc">精華 Hook</p>
                    <h3 className="variant-title">0-3 秒</h3>
                    <p className="variant-copy">{result.recommendedHook}</p>
                  </article>
                  <article className="variant-card">
                    <p className="panel-desc">CTA</p>
                    <h3 className="variant-title">10-15 秒</h3>
                    <p className="variant-copy">{result.recommendedCTA}</p>
                  </article>
                </div>

                <div className="stack">
                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">Key Takeaways</h3>
                      <CopyButton text={result.keyTakeaways.join("\n")} />
                    </div>
                    <div className="variant-list">
                      {result.keyTakeaways.map((item, index) => (
                        <article key={`${item}-${index}`} className="variant-card">
                          <p className="variant-copy">{item}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">精華亮點</h3>
                      <span className="panel-desc">可直接作為剪輯節點</span>
                    </div>
                    <div className="variant-list">
                      {result.highlightMoments.map((moment) => (
                        <article key={moment.title} className="variant-card">
                          <div className="panel-header" style={{ marginBottom: 8 }}>
                            <h4 className="variant-title">{moment.title}</h4>
                            <span className="status status-muted">
                              {moment.startHint} → {moment.endHint}
                            </span>
                          </div>
                          <p className="variant-copy">{moment.reason}</p>
                          <p className="panel-desc">{moment.visualSuggestion}</p>
                          {moment.quote ? <p className="panel-desc">{moment.quote}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">建議切點</h3>
                      <span className="panel-desc">15 / 30 秒都能沿用</span>
                    </div>
                    <div className="variant-list">
                      {result.suggestedCuts.map((cut) => (
                        <article key={cut.title} className="variant-card">
                          <div className="panel-header" style={{ marginBottom: 8 }}>
                            <h4 className="variant-title">{cut.title}</h4>
                            <CopyButton text={`${cut.title}\n${cut.description}\n${cut.startHint} -> ${cut.endHint}`} />
                          </div>
                          <p className="variant-copy">{cut.description}</p>
                          <div className="meta-row">
                            <span className="meta">{cut.startHint}</span>
                            <span className="meta">{cut.endHint}</span>
                            <span className="meta">{cut.angle}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="panel-header">
                      <h3 className="panel-title">產出版本</h3>
                      <span className="panel-desc">標題、亮點、腳本、切點都已整理好</span>
                    </div>
                    <div className="variant-tabs">
                      {variantTabs.map((tab) => (
                        <button
                          key={tab.value}
                          type="button"
                          className={`chip ${selectedVariantType === tab.value ? "chip-active" : ""}`}
                          onClick={() => setSelectedVariantType(tab.value)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {currentGroup ? (
                      <div className="variant-list" style={{ marginTop: 14 }}>
                        {currentGroup.items.map((variant) => (
                          <article key={variant.id} className="variant-card">
                            <div className="panel-header" style={{ marginBottom: 8 }}>
                              <h4 className="variant-title">{variant.title ?? variant.previewText}</h4>
                              <CopyButton
                                text={[
                                  variant.title ?? variant.previewText,
                                  JSON.stringify(variant.payload, null, 2)
                                ].join("\n")}
                              />
                            </div>
                            <p className="variant-copy">{variant.previewText}</p>
                            {variant.variantType === "TITLE" ? (
                              <p className="panel-desc">{variant.payload.rationale}</p>
                            ) : null}
                            {variant.variantType === "HIGHLIGHT" ? (
                              <>
                                <p className="panel-desc">{variant.payload.reason}</p>
                                <p className="panel-desc">{variant.payload.visualSuggestion}</p>
                              </>
                            ) : null}
                            {variant.variantType === "SCRIPT" ? (
                              <div className="variant-copy">
                                <strong>Hook</strong>
                                <br />
                                {variant.payload.hook}
                                <br />
                                <br />
                                <strong>中段</strong>
                                <br />
                                {variant.payload.middle}
                                <br />
                                <br />
                                <strong>CTA</strong>
                                <br />
                                {variant.payload.cta}
                              </div>
                            ) : null}
                            {variant.variantType === "CUT_PLAN" ? (
                              <p className="panel-desc">
                                {variant.payload.startHint} → {variant.payload.endHint} · {variant.payload.angle}
                              </p>
                            ) : null}
                            <div className="meta-row">
                              {variant.platforms.map((platform) => (
                                <span key={platform} className="meta">
                                  {platform}
                                </span>
                              ))}
                              {variant.hashtags.map((tag) => (
                                <span key={tag} className="meta">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </article>
                        ))}
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
                  <h2 className="panel-title">AI 即時摘要</h2>
                  <p className="panel-desc">分析過程中與完成後都會顯示最新重點。</p>
                </div>
              </div>
              <div className="summary-stack">
                <article className="summary-card">
                  <p className="panel-desc">摘要</p>
                  <h3 className="summary-title">{liveSummary}</h3>
                </article>
                <article className="summary-card">
                  <p className="panel-desc">建議 Hook</p>
                  <h3 className="summary-title">{liveHook}</h3>
                </article>
                <article className="summary-card">
                  <p className="panel-desc">建議 CTA</p>
                  <h3 className="summary-title">{liveCTA}</h3>
                </article>
                {result ? (
                  <article className="summary-card summary-card-highlight">
                    <p className="panel-desc">下一步</p>
                    <h3 className="summary-title">已自動準備送去影片工作台</h3>
                    <p className="panel-desc">如果沒有跳轉，點右上角的「送去影片生成」即可。</p>
                    <Link className="btn btn-secondary" href={videoStudioHref} style={{ marginTop: 10 }}>
                      立刻前往影片工作台
                    </Link>
                  </article>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">最近分析紀錄</h2>
                  <p className="panel-desc">每次貼網址都會留存，方便下次直接再看。</p>
                </div>
              </div>
              <div className="list">
                {history.map((item) => (
                  <article key={item.id} className="list-item">
                    <div className="panel-header" style={{ marginBottom: 8 }}>
                      <h3 className="list-title">{item.sourceTitle ?? item.sourceHost}</h3>
                      <span className="status status-muted">{Math.round(item.confidenceScore * 100)}%</span>
                    </div>
                    <p className="list-subtitle">{item.analysisGoal}</p>
                    <p className="list-subtitle">
                      {item.sourceType} · {item.analysisMode ?? "未指定模式"}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">分析流程</h2>
                  <p className="panel-desc">系統會先抓來源摘要，再輸出可直接用的版本。</p>
                </div>
              </div>
              <div className="list">
                <article className="list-item">
                  <h3 className="list-title">1. 貼上網址</h3>
                  <p className="list-subtitle">支援 YouTube、TikTok、IG、FB 與一般頁面。</p>
                </article>
                <article className="list-item">
                  <h3 className="list-title">2. 擷取重點</h3>
                  <p className="list-subtitle">抓標題、摘要、關鍵字與精華段落。</p>
                </article>
                <article className="list-item">
                  <h3 className="list-title">3. 產出內容</h3>
                  <p className="list-subtitle">直接得到標題、切點、腳本與平台建議。</p>
                </article>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
