"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import { CopyButton } from "../../components/copy-button";
import { OptionPicker } from "../../components/option-picker";
import { readTenantSession, type TenantSession } from "../../lib/tenant-session";

type ContentItem = {
  id: string;
  summary: string;
  request: {
    productName: string;
    targetAudience: string;
    keywords: string[];
  };
  scripts: Array<{
    id: string;
    title: string;
    payload: {
      title?: string;
      hook?: string;
      middle?: string;
      cta?: string;
    };
  }>;
};

type VideoProjectSummary = {
  id: string;
  title: string;
  status: string;
  style: string;
  mediaMode: string;
  durationSeconds: number;
  createdAt: string;
  output: {
    id: string;
    filePath: string;
    publicUrl: string | null;
    width: number;
    height: number;
    status: string;
  } | null;
  content: {
    id: string;
    productName: string;
  };
};

type VideoProjectDetail = {
  projectId: string;
  projectStatus: string;
  outputId: string;
  filePath: string;
  publicUrl: string | null;
  durationSeconds: number;
  segments: Array<{
    segmentType: string;
    voiceText: string;
    subtitleText: string;
    visualPrompt: string;
    transition: string;
    startSecond: number;
    endSecond: number;
  }>;
};

type AiProviderBinding = {
  id: string;
  scopeKey: string;
  provider: "OPENAI" | "GEMINI";
  label: string;
  apiBaseUrl: string | null;
  defaultModel: string | null;
  isActive: boolean;
  apiKeyLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  status: "READY" | "NEEDS_CONFIG" | "ERROR" | "DISABLED";
  metadata: Record<string, unknown> | null;
};

type UrlAnalysisResult = {
  id: string;
  requestId: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: string;
  sourceTitle: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  targetAudience: string | null;
  desiredTone: string | null;
  desiredLengthSeconds: number;
  focusKeywords: string[];
  topic: string;
  summary: string;
  keyTakeaways: string[];
  recommendedPlatforms: string[];
  recommendedLengthSeconds: number;
  recommendedHook: string;
  recommendedCTA: string;
  confidenceScore: number;
};

const STYLE_OPTIONS = [
  { value: "AUTO", label: "自動判斷" },
  { value: "SALES", label: "帶貨快節奏" },
  { value: "PREMIUM", label: "高級質感" },
  { value: "TECH", label: "科技感" },
  { value: "SOCIAL", label: "社群感" }
];

const AI_PROVIDER_OPTIONS = [
  { value: "AUTO", label: "自動選擇", description: "先用已綁定的 OpenAI，再切 Gemini" },
  { value: "OPENAI", label: "OpenAI", description: "優先使用 OpenAI 影像 API" },
  { value: "GEMINI", label: "Gemini", description: "優先使用 Gemini 影像 API" }
];

const BINDING_ACTION_OPTIONS = [
  { value: "SAVE", label: "儲存綁定", description: "寫入 API Key 與預設模型", icon: "◎", tone: "info" as const },
  { value: "TEST", label: "測試連線", description: "立即驗證目前的設定是否可用", icon: "↻", tone: "success" as const },
  { value: "DISCONNECT", label: "解除綁定", description: "清除該供應器的綁定資料", icon: "×", tone: "warning" as const }
];

const BINDING_MODE_OPTIONS = [
  { value: "OPENAI", label: "OpenAI", description: "只啟用 OpenAI" },
  { value: "GEMINI", label: "Gemini", description: "只啟用 Gemini" },
  { value: "BOTH", label: "OpenAI + Gemini", description: "同時啟用兩個供應器" }
] as const;

const OPENAI_MODEL_OPTIONS = [
  { value: "gpt-image-2", label: "gpt-image-2", description: "影像生成預設建議" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini", description: "快速、低成本的文字與結構分析" },
  { value: "gpt-4.1", label: "gpt-4.1", description: "高品質文字與推理" },
  { value: "gpt-4o-mini", label: "gpt-4o-mini", description: "兼顧速度與成本" }
];

const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.5-flash-image", label: "gemini-2.5-flash-image", description: "影像生成預設建議" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash", description: "快速、穩定的多模態模型" },
  { value: "gemini-2.5-pro", label: "gemini-2.5-pro", description: "高品質推理與內容整合" }
];

type BindingAction = "SAVE" | "TEST" | "DISCONNECT";

type BindingFeedback = {
  tone: "success" | "warning" | "danger" | "info";
  message: string;
};

export default function VideoStudioPage() {
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [analysisIdFromQuery, setAnalysisIdFromQuery] = useState("");
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<VideoProjectSummary[]>([]);
  const [bindings, setBindings] = useState<AiProviderBinding[]>([]);
  const [analysisSource, setAnalysisSource] = useState<UrlAnalysisResult | null>(null);
  const [selectedContentId, setSelectedContentId] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [duration, setDuration] = useState<15 | 30>(15);
  const [requestedStyle, setRequestedStyle] = useState("AUTO");
  const [mediaMode, setMediaMode] = useState("HYBRID");
  const [imageProvider, setImageProvider] = useState("AUTO");
  const [sourceMode, setSourceMode] = useState<"CONTENT" | "ANALYSIS">(analysisIdFromQuery ? "ANALYSIS" : "CONTENT");
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("gpt-image-2");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-image");
  const [loading, setLoading] = useState(false);
  const [bindingLoading, setBindingLoading] = useState<Record<string, boolean>>({});
  const [refreshingBindings, setRefreshingBindings] = useState(false);
  const [bindingActions, setBindingActions] = useState<Record<string, BindingAction>>({
    OPENAI: "SAVE",
    GEMINI: "SAVE"
  });
  const [bindingFeedback, setBindingFeedback] = useState<Record<string, BindingFeedback>>({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VideoProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bindingMessage, setBindingMessage] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  useEffect(() => {
    setTenantSession(readTenantSession());
    void loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAnalysisIdFromQuery(params.get("analysisId") ?? "");
  }, []);

  useEffect(() => {
    if (!analysisIdFromQuery) {
      return;
    }

    setSourceMode("ANALYSIS");
    void loadAnalysis(analysisIdFromQuery);
  }, [analysisIdFromQuery]);

  async function loadData() {
    try {
      const session = readTenantSession();
      const tenantQuery = session?.tenantId ? `&tenantId=${encodeURIComponent(session.tenantId)}` : "";
      const [contentItems, videoItems, bindingItems] = await Promise.all([
        apiFetch<ContentItem[]>(`/contents?take=20${tenantQuery}`),
        apiFetch<VideoProjectSummary[]>(`/videos?take=20${tenantQuery}`),
        apiFetch<AiProviderBinding[]>("/ai/providers?scopeKey=GLOBAL")
      ]);
      setContents(contentItems);
      setVideos(videoItems);
      setBindings(bindingItems);
      if (!selectedContentId && contentItems[0]) {
        setSelectedContentId(contentItems[0].id);
        setSelectedScriptId(contentItems[0].scripts[0]?.id ?? "");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAnalysis(analysisId: string) {
    try {
      const item = await apiFetch<UrlAnalysisResult>(`/url-analysis/analyses/${analysisId}`);
      setAnalysisSource(item);
      setAnalysisMessage(`已載入分析：${item.sourceTitle ?? item.sourceHost}`);
      setDuration(item.recommendedLengthSeconds === 15 ? 15 : 30);
    } catch (err) {
      setAnalysisSource(null);
      setAnalysisMessage(err instanceof Error ? err.message : "無法載入網址分析");
    }
  }

  const selectedContent = useMemo(
    () => contents.find((item) => item.id === selectedContentId) ?? null,
    [contents, selectedContentId]
  );

  const bindingStats = useMemo(() => {
    const bound = bindings.filter((item) => item.status !== "NEEDS_CONFIG").length;
    const active = bindings.filter((item) => item.isActive && item.status !== "NEEDS_CONFIG").length;
    const disabled = bindings.filter((item) => item.status === "DISABLED").length;
    const needsConfig = bindings.filter((item) => item.status === "NEEDS_CONFIG").length;
    const error = bindings.filter((item) => item.status === "ERROR").length;
    const total = Math.max(bindings.length, 2);
    const progress = Math.round((active / total) * 100);

    return { bound, active, disabled, needsConfig, error, total, progress };
  }, [bindings]);

  const enabledProviderLabels = useMemo(() => {
    return bindings
      .filter((item) => item.status === "READY" && item.isActive)
      .map((item) => item.label)
      .join(" + ");
  }, [bindings]);

  useEffect(() => {
    if (selectedContent && !selectedScriptId) {
      setSelectedScriptId(selectedContent.scripts[0]?.id ?? "");
    }
  }, [selectedContent, selectedScriptId]);

  async function refreshBindings() {
    setRefreshingBindings(true);
    try {
      const items = await apiFetch<AiProviderBinding[]>("/ai/providers?scopeKey=GLOBAL");
      setBindings(items);
      setBindingMessage("已重新整理 AI 綁定狀態");
    } catch (err) {
      const message = err instanceof Error ? err.message : "重新整理失敗";
      setBindingMessage(message);
      console.error(err);
    } finally {
      setRefreshingBindings(false);
    }
  }

  function updateBindingFeedback(provider: "OPENAI" | "GEMINI", tone: BindingFeedback["tone"], message: string) {
    setBindingFeedback((current) => ({
      ...current,
      [provider]: { tone, message }
    }));
  }

  function getActionOption(action: BindingAction) {
    return BINDING_ACTION_OPTIONS.find((item) => item.value === action) ?? BINDING_ACTION_OPTIONS[0];
  }

  function getProviderTone(binding: AiProviderBinding | null): "success" | "warning" | "danger" | "info" {
    if (!binding) return "warning";
    if (binding.status === "READY") return "success";
    if (binding.status === "DISABLED") return "warning";
    if (binding.status === "ERROR") return "danger";
    return "info";
  }

  function getStatusLight(binding: AiProviderBinding | null): "on" | "off" | "warn" {
    if (!binding) return "warn";
    if (binding.status === "READY") return "on";
    if (binding.status === "DISABLED") return "warn";
    if (binding.status === "ERROR") return "off";
    return "warn";
  }

  function getBaseUrlLight(binding: AiProviderBinding | null): "on" | "off" | "warn" {
    if (!binding) return "warn";
    if (binding.status === "READY" && binding.apiBaseUrl) return "on";
    if (binding.status === "DISABLED") return "warn";
    if (binding.status === "ERROR") return "off";
    return "warn";
  }

  function getBindingLabel(binding: AiProviderBinding | null) {
    if (!binding) {
      return "尚未綁定";
    }
    if (binding.status === "DISABLED") {
      return `已停用 · ${binding.label}`;
    }
    return `已綁定 · ${binding.label}`;
  }

  async function applyBindingMode(mode: "OPENAI" | "GEMINI" | "BOTH") {
    setRefreshingBindings(true);
    setBindingMessage(null);

    const updates: Array<{ provider: "OPENAI" | "GEMINI"; isActive: boolean }> =
      mode === "OPENAI"
        ? [
            { provider: "OPENAI", isActive: true },
            { provider: "GEMINI", isActive: false }
          ]
        : mode === "GEMINI"
          ? [
              { provider: "OPENAI", isActive: false },
              { provider: "GEMINI", isActive: true }
            ]
          : [
              { provider: "OPENAI", isActive: true },
              { provider: "GEMINI", isActive: true }
            ];

    try {
      const updatedBindings = await Promise.all(
        updates.map((item) =>
          apiFetch<AiProviderBinding>(`/ai/providers/${item.provider}/active?scopeKey=GLOBAL`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: item.isActive })
          })
        )
      );

      setBindings((currentBindings) =>
        currentBindings.map((item) => updatedBindings.find((updated) => updated.provider === item.provider) ?? item)
      );

      setBindingMessage(
        mode === "OPENAI"
          ? "已切換成只使用 OpenAI"
          : mode === "GEMINI"
            ? "已切換成只使用 Gemini"
            : "已切換成同時使用 OpenAI 與 Gemini"
      );
      updateBindingFeedback(
        "OPENAI",
        mode === "OPENAI" || mode === "BOTH" ? "success" : "warning",
        mode === "OPENAI"
          ? "OpenAI 已啟用，Gemini 已停用"
          : mode === "BOTH"
            ? "OpenAI 已與 Gemini 一起啟用"
            : "OpenAI 已停用"
      );
      updateBindingFeedback(
        "GEMINI",
        mode === "GEMINI" || mode === "BOTH" ? "success" : "warning",
        mode === "GEMINI"
          ? "Gemini 已啟用，OpenAI 已停用"
          : mode === "BOTH"
            ? "Gemini 已與 OpenAI 一起啟用"
            : "Gemini 已停用"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "切換 AI 模式失敗";
      setBindingMessage(message);
    } finally {
      setRefreshingBindings(false);
      await refreshBindings();
    }
  }

  async function toggleBindingActive(provider: "OPENAI" | "GEMINI") {
    const current = bindings.find((item) => item.provider === provider);
    const nextActive = !current?.isActive;
    setBindingLoading((value) => ({ ...value, [`${provider}-toggle`]: true }));
    setBindingMessage(null);

    try {
      const updated = await apiFetch<AiProviderBinding>(`/ai/providers/${provider}/active?scopeKey=GLOBAL`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive })
      });
      setBindings((currentBindings) =>
        currentBindings.map((item) => (item.provider === provider ? updated : item))
      );
      updateBindingFeedback(
        provider,
        nextActive ? "success" : "warning",
        nextActive ? `${updated.label} 已啟用，可供影片生成使用` : `${updated.label} 已停用，將不再參與自動選擇`
      );
      setBindingMessage(nextActive ? `${updated.label} 已啟用` : `${updated.label} 已停用`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "切換失敗";
      setBindingMessage(message);
      updateBindingFeedback(provider, "danger", message);
    } finally {
      setBindingLoading((value) => ({ ...value, [`${provider}-toggle`]: false }));
    }
  }

  async function saveBinding(provider: "OPENAI" | "GEMINI") {
    const apiKey = provider === "OPENAI" ? openAiKey.trim() : geminiKey.trim();
    const defaultModel = provider === "OPENAI" ? openAiModel.trim() : geminiModel.trim();

    if (!apiKey) {
      setBindingMessage(`${provider} API key 不可為空`);
      updateBindingFeedback(provider, "danger", `${provider} API key 不可為空`);
      return;
    }

    setBindingLoading((value) => ({ ...value, [provider]: true }));
    setBindingMessage(null);
    try {
      await apiFetch("/ai/providers/bind", {
        method: "POST",
        body: JSON.stringify({
          scopeKey: "GLOBAL",
          provider,
          apiKey,
          defaultModel
        })
      });
      setBindingMessage(`${provider} 已完成綁定`);
      updateBindingFeedback(provider, "success", `${provider} 已完成綁定，預設模型：${defaultModel || "未指定"}`);
      if (provider === "OPENAI") setOpenAiKey("");
      if (provider === "GEMINI") setGeminiKey("");
      await refreshBindings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "綁定失敗";
      setBindingMessage(message);
      updateBindingFeedback(provider, "danger", message);
    } finally {
      setBindingLoading((value) => ({ ...value, [provider]: false }));
    }
  }

  async function testBinding(provider: "OPENAI" | "GEMINI") {
    setBindingLoading((value) => ({ ...value, [`${provider}-test`]: true }));
    setBindingMessage(null);
    try {
      await apiFetch(`/ai/providers/${provider}/test?scopeKey=GLOBAL`, {
        method: "POST"
      });
      setBindingMessage(`${provider} 連線測試成功`);
      updateBindingFeedback(provider, "success", `${provider} 連線測試成功，系統已確認可呼叫 API`);
      await refreshBindings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "測試失敗";
      setBindingMessage(message);
      updateBindingFeedback(provider, "danger", message);
    } finally {
      setBindingLoading((value) => ({ ...value, [`${provider}-test`]: false }));
    }
  }

  async function disconnectBinding(provider: "OPENAI" | "GEMINI") {
    setBindingLoading((value) => ({ ...value, [`${provider}-delete`]: true }));
    setBindingMessage(null);
    try {
      await apiFetch(`/ai/providers/${provider}?scopeKey=GLOBAL`, {
        method: "DELETE"
      });
      setBindingMessage(`${provider} 已解除綁定`);
      updateBindingFeedback(provider, "warning", `${provider} 已解除綁定，請重新儲存 API Key 以恢復使用`);
      await refreshBindings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "解除失敗";
      setBindingMessage(message);
      updateBindingFeedback(provider, "danger", message);
    } finally {
      setBindingLoading((value) => ({ ...value, [`${provider}-delete`]: false }));
    }
  }

  async function runBindingAction(provider: "OPENAI" | "GEMINI") {
    const action = bindingActions[provider];
    if (action === "SAVE") {
      await saveBinding(provider);
      return;
    }
    if (action === "TEST") {
      await testBinding(provider);
      return;
    }
    await disconnectBinding(provider);
  }

  async function handleGenerate() {
    if (sourceMode === "ANALYSIS" && !analysisSource) return;
    if (sourceMode === "CONTENT" && !selectedContent) return;
    setLoading(true);
    setError(null);
    setProgress(15);

    const interval = window.setInterval(() => {
      setProgress((value) => Math.min(92, value + Math.random() * 10));
    }, 280);

    try {
      const payload =
        sourceMode === "ANALYSIS" && analysisSource
          ? {
              tenantId: tenantSession?.tenantId,
              analysisId: analysisSource.requestId,
              targetDurationSeconds: duration,
              requestedStyle,
              mediaMode,
              imageProvider
            }
          : {
              tenantId: tenantSession?.tenantId,
              contentId: selectedContent?.id,
              scriptVariantId: selectedScriptId || undefined,
              targetDurationSeconds: duration,
              requestedStyle,
              mediaMode,
              imageProvider
            };

      const data = await apiFetch<VideoProjectDetail>("/generate-video", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(data);
      setProgress(100);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "影片生成失敗");
      setProgress(0);
    } finally {
      window.clearInterval(interval);
      setTimeout(() => setProgress(0), 1200);
      setLoading(false);
    }
  }

  const playbackUrl = result?.publicUrl ? `${API_BASE_URL}${result.publicUrl}` : result?.projectId ? `${API_BASE_URL}/video/${result.projectId}/file` : null;
  const openAiBinding = bindings.find((item) => item.provider === "OPENAI") ?? null;
  const geminiBinding = bindings.find((item) => item.provider === "GEMINI") ?? null;
  const bindingModeValue: "OPENAI" | "GEMINI" | "BOTH" | "NONE" =
    openAiBinding?.isActive && openAiBinding?.status !== "NEEDS_CONFIG"
      ? geminiBinding?.isActive && geminiBinding?.status !== "NEEDS_CONFIG"
        ? "BOTH"
        : "OPENAI"
      : geminiBinding?.isActive && geminiBinding?.status !== "NEEDS_CONFIG"
        ? "GEMINI"
        : "NONE";

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">Video Studio</p>
          <h1 className="title">AI 自動短影音生成引擎</h1>
          <p className="subtle">
            把腳本直接轉成可發布的 9:16 影片，包含畫面、字幕、音樂、配音與 CTA。這一頁先把影片生產線跑順。
          </p>
        </div>
        {tenantSession ? <div className="status status-muted">{tenantSession.tenantName} · {tenantSession.workspaceName}</div> : null}
        <div className="status status-processing">MP4 · 1080x1920 · 15 / 30 秒</div>
      </header>

      <div className="stack">
        {loading || progress > 0 ? (
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <h2 className="panel-title">生成進度</h2>
                <span className="status status-processing">{Math.round(progress)}%</span>
              </div>
              <div className="progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          </section>
        ) : null}

        <div className="page-grid">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">生成設定</h2>
                  <p className="panel-desc">選擇一段已生成腳本，系統會自動生成影片專案與輸出檔。</p>
                </div>
                {loading ? <span className="status status-processing">處理中</span> : <span className="status status-success">可生成</span>}
              </div>

              <div className="stack">
                <div className="toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
                  <div className="variant-tabs">
                    <button
                      type="button"
                      className={`chip ${sourceMode === "CONTENT" ? "chip-active" : ""}`}
                      onClick={() => setSourceMode("CONTENT")}
                    >
                      內容素材
                    </button>
                    <button
                      type="button"
                      className={`chip ${sourceMode === "ANALYSIS" ? "chip-active" : ""}`}
                      onClick={() => setSourceMode("ANALYSIS")}
                    >
                      網址分析
                    </button>
                  </div>
                  <span className="status status-muted">
                    {sourceMode === "ANALYSIS" ? "直接把分析結果轉成影片專案" : "從既有內容與腳本生成影片"}
                  </span>
                </div>

                {analysisMessage ? <p className="subtle">{analysisMessage}</p> : null}

                {sourceMode === "ANALYSIS" ? (
                  analysisSource ? (
                    <article className="variant-card">
                      <div className="panel-header" style={{ marginBottom: 8 }}>
                        <h3 className="variant-title">{analysisSource.sourceTitle ?? analysisSource.sourceHost}</h3>
                        <span className="status status-success">{Math.round(analysisSource.confidenceScore * 100)}%</span>
                      </div>
                      <p className="variant-copy">{analysisSource.summary}</p>
                      <div className="meta-row" style={{ marginTop: 10 }}>
                        <span className="meta">{analysisSource.recommendedLengthSeconds}s</span>
                        <span className="meta">{analysisSource.desiredTone ?? "未指定語氣"}</span>
                        {analysisSource.recommendedPlatforms.map((platform) => (
                          <span key={platform} className="meta">
                            {platform}
                          </span>
                        ))}
                      </div>
                      <div className="variant-copy" style={{ marginTop: 12 }}>
                        <strong>Hook</strong>
                        <br />
                        {analysisSource.recommendedHook}
                        <br />
                        <br />
                        <strong>CTA</strong>
                        <br />
                        {analysisSource.recommendedCTA}
                      </div>
                    </article>
                  ) : (
                    <article className="variant-card">
                      <p className="variant-copy">請先從「網址分析」頁面載入一筆分析結果，或在網址列帶上 `analysisId`。</p>
                    </article>
                  )
                ) : (
                  <>
                    <OptionPicker
                      label="內容來源"
                      value={selectedContentId}
                      options={contents.map((item) => ({
                        value: item.id,
                        label: item.request.productName,
                        description: item.request.targetAudience
                      }))}
                      onChange={(value) => {
                        setSelectedContentId(value);
                        const picked = contents.find((item) => item.id === value);
                        setSelectedScriptId(picked?.scripts[0]?.id ?? "");
                      }}
                      helperText="所有內容直接顯示，不需要展開選單。"
                    />

                    <OptionPicker
                      label="腳本版本"
                      value={selectedScriptId}
                      options={(selectedContent?.scripts ?? []).map((script) => ({
                        value: script.id,
                        label: script.title,
                        description: script.payload.hook ?? "腳本段落預覽"
                      }))}
                      onChange={(value) => setSelectedScriptId(value)}
                      helperText="切換腳本時會直接顯示完整版本。"
                    />
                  </>
                )}

                <div className="form-grid">
                  <OptionPicker
                    label="影片長度"
                    value={String(duration)}
                    options={[
                      { value: "15", label: "15 秒", description: "短節奏，適合強 Hook" },
                      { value: "30", label: "30 秒", description: "資訊更完整，適合說明型" }
                    ]}
                    onChange={(value) => setDuration(Number(value) as 15 | 30)}
                    compact
                  />
                  <OptionPicker
                    label="影片風格"
                    value={requestedStyle}
                    options={STYLE_OPTIONS}
                    onChange={(value) => setRequestedStyle(value)}
                    compact
                  />
                  <OptionPicker
                    label="素材模式"
                    value={mediaMode}
                    options={[
                      { value: "REAL_MEDIA", label: "真實素材版", description: "優先抓取免費真實素材" },
                      { value: "AI_IMAGE", label: "AI 影像版", description: "優先使用 AI 生成圖像" },
                      { value: "HYBRID", label: "混合版", description: "真實素材與 AI 影像混搭" }
                    ]}
                    onChange={(value) => setMediaMode(value)}
                    compact
                  />
                  <OptionPicker
                    label="AI 影像供應器"
                    value={imageProvider}
                    options={AI_PROVIDER_OPTIONS}
                    onChange={(value) => setImageProvider(value)}
                    compact
                  />
                </div>

                <div className="toolbar">
                  <button
                    className="btn"
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading || (sourceMode === "CONTENT" ? !selectedContentId : !analysisSource)}
                  >
                    {loading
                      ? "生成影片中..."
                      : sourceMode === "ANALYSIS"
                        ? "從分析生成影片"
                        : "生成影片"}
                  </button>
                  <span className="status status-muted">
                    {sourceMode === "CONTENT"
                      ? `腳本預覽：${selectedContent?.scripts.find((item) => item.id === selectedScriptId)?.title ?? "未選擇"}`
                      : "將以分析結果自動建立內容並生成影片"}
                  </span>
                </div>

                {error ? <p className="subtle" style={{ color: "var(--danger)" }}>{error}</p> : null}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">影片預覽</h2>
                  <p className="panel-desc">生成完成後直接可播放，右側列出最近專案。</p>
                </div>
              </div>

              {playbackUrl ? (
                <div className="video-frame" style={{ marginBottom: 16 }}>
                  <video controls src={playbackUrl} />
                </div>
              ) : (
                <div className="video-frame" style={{ display: "grid", placeItems: "center", color: "var(--muted)", marginBottom: 16 }}>
                  尚未生成影片
                </div>
              )}

              {result ? (
                <div className="variant-card">
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <h3 className="variant-title">專案資訊</h3>
                    <CopyButton text={`videoId: ${result.projectId}\noutputId: ${result.outputId}`} />
                  </div>
                  <p className="variant-copy">狀態：{result.projectStatus}</p>
                  <div className="meta-row">
                    <span className="meta">長度 {result.durationSeconds}s</span>
                    <span className="meta">影片 {result.projectId}</span>
                  </div>
                  <div className="variant-list" style={{ marginTop: 14 }}>
                    {result.segments.map((segment) => (
                      <div key={`${segment.segmentType}-${segment.startSecond}`} className="variant-card">
                        <div className="panel-header" style={{ marginBottom: 8 }}>
                          <h4 className="variant-title">{segment.segmentType}</h4>
                          <span className="status status-muted">
                            {segment.startSecond}s - {segment.endSecond}s
                          </span>
                        </div>
                        <p className="variant-copy">{segment.voiceText}</p>
                        <p className="panel-desc">視覺：{segment.visualPrompt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">AI API 綁定</h2>
                <p className="panel-desc">可直接綁定 OpenAI / Gemini API，影片生成會優先使用已綁定的供應器。</p>
              </div>
              <span className="status status-processing">GLOBAL scope</span>
            </div>

            {bindingMessage ? <p className="subtle" style={{ marginBottom: 16 }}>{bindingMessage}</p> : null}

            <section className="summary-card summary-card-highlight" style={{ marginBottom: 18 }}>
              <div className="panel-header" style={{ marginBottom: 10 }}>
                <div>
                  <h3 className="variant-title">綁定總狀態</h3>
                  <p className="panel-desc">快速掌握目前 OpenAI / Gemini 的綁定、測試與錯誤狀況。</p>
                </div>
                <span className="status status-success">{bindingStats.active}/{bindingStats.total} 已啟用</span>
              </div>
              <div className="binding-summary-progress">
                <span style={{ width: `${bindingStats.progress}%` }} />
              </div>
              <div className="binding-summary-metrics">
                <span className="chip">已啟用 {bindingStats.active}</span>
                <span className="chip">已綁定 {bindingStats.bound}</span>
                <span className="chip">已停用 {bindingStats.disabled}</span>
                <span className="chip">需設定 {bindingStats.needsConfig}</span>
                <span className="chip">錯誤 {bindingStats.error}</span>
                <span className="chip">總數 {bindingStats.total}</span>
              </div>
              <div className="summary-card" style={{ marginTop: 12 }}>
                <p className="panel-desc">目前模式</p>
                <strong className="summary-title" style={{ marginTop: 4 }}>
                  {enabledProviderLabels || "尚未啟用"}
                </strong>
                <div className="binding-mode-switcher" style={{ marginTop: 12 }}>
                  {BINDING_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`binding-mode-button ${bindingModeValue === option.value ? "binding-mode-button-active" : ""}`}
                      onClick={() => void applyBindingMode(option.value)}
                      disabled={refreshingBindings}
                      title={option.description}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="binding-layout">
              <aside className="panel binding-sidebar">
                <div className="panel-inner">
                <div className="panel-header">
                  <div>
                    <h3 className="variant-title">供應器健康</h3>
                    <p className="panel-desc">綁定成功後會鎖定模型，下方顯示即時健康狀態。</p>
                  </div>
                  <button type="button" className="chip" onClick={() => void refreshBindings()} disabled={refreshingBindings}>
                    {refreshingBindings ? "重新整理中..." : "重新整理"}
                  </button>
                </div>
                    <div className="summary-stack">
                      <div className="summary-card summary-card-highlight">
                        <p className="panel-desc">總覽</p>
                        <p className="summary-title">已啟用 {bindingStats.active} / 總數 {bindingStats.total}</p>
                        <div className="binding-summary-progress" style={{ marginTop: 10 }}>
                          <span style={{ width: `${bindingStats.progress}%` }} />
                        </div>
                        <div className="chip-row" style={{ marginTop: 10 }}>
                          <span className="chip">模式：{enabledProviderLabels || "尚未啟用"}</span>
                        </div>
                      </div>
                    {[
                      { provider: "OPENAI" as const, binding: openAiBinding },
                      { provider: "GEMINI" as const, binding: geminiBinding }
                    ].map((item) => {
                      const tone = getProviderTone(item.binding);
                      return (
                        <div key={item.provider} className={`binding-feedback-card binding-feedback-${tone}`}>
                          <div className="panel-header" style={{ marginBottom: 8 }}>
                            <h4 className="variant-title" style={{ fontSize: "0.98rem" }}>{item.provider}</h4>
                            <span className={`status ${item.binding?.status === "READY" ? "status-success" : "status-muted"}`}>
                              {item.binding?.status ?? "NONE"}
                            </span>
                          </div>
                          <p className="summary-title" style={{ margin: 0 }}>
                            {item.binding?.defaultModel ?? "尚未設定模型"}
                          </p>
                          <div className="binding-model-card" style={{ marginTop: 10 }}>
                            <span className="panel-desc">目前模型提示</span>
                            <strong className="binding-model-value">
                              {item.binding?.status === "READY"
                                ? `${item.binding.defaultModel ?? "未指定"}（已鎖定）`
                                : item.binding?.defaultModel ?? "尚未設定模型"}
                            </strong>
                          </div>
                          <p className="helper-text" style={{ marginTop: 8 }}>
                            {item.binding?.lastVerifiedAt
                              ? `最後驗證：${new Date(item.binding.lastVerifiedAt).toLocaleString("zh-TW")}`
                              : "尚未完成連線測試"}
                          </p>
                          <div className="chip-row" style={{ marginTop: 10 }}>
                            <span className="chip">{item.binding?.source ?? "NONE"}</span>
                            <span className={`chip binding-light binding-light-${getStatusLight(item.binding)}`}>
                              {item.binding?.status === "READY" ? "綁定已就緒" : item.binding?.status === "ERROR" ? "需修正" : "待設定"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <div className="binding-main">
              <div className="page-grid binding-provider-grid">
              {([
                {
                  provider: "OPENAI" as const,
                  title: "OpenAI",
                  hint: "適合高品質 AI 影像生成與後續擴充",
                  binding: openAiBinding,
                  keyValue: openAiKey,
                  setKey: setOpenAiKey,
                  modelValue: openAiModel,
                  setModel: setOpenAiModel,
                  placeholder: "sk-...",
                  modelPlaceholder: "gpt-image-2",
                  modelOptions: OPENAI_MODEL_OPTIONS
                },
                {
                  provider: "GEMINI" as const,
                  title: "Gemini",
                  hint: "適合 Google 系列 API 與 Gemini 影像能力",
                  binding: geminiBinding,
                  keyValue: geminiKey,
                  setKey: setGeminiKey,
                  modelValue: geminiModel,
                  setModel: setGeminiModel,
                  placeholder: "AIza...",
                  modelPlaceholder: "gemini-2.5-flash-image",
                  modelOptions: GEMINI_MODEL_OPTIONS
                }
              ]).map((card) => (
                <article key={card.provider} className="variant-card">
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <h3 className="variant-title">{card.title}</h3>
                      <span className={`status ${card.binding?.status === "READY" ? "status-success" : card.binding?.status === "DISABLED" ? "status-muted" : "status-muted"}`}>
                        {getBindingLabel(card.binding)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`binding-toggle ${card.binding?.isActive ? "binding-toggle-on" : "binding-toggle-off"}`}
                      onClick={() => void toggleBindingActive(card.provider)}
                      disabled={bindingLoading[`${card.provider}-toggle`] || card.binding?.status === "NEEDS_CONFIG"}
                      aria-pressed={Boolean(card.binding?.isActive)}
                      title={card.binding?.isActive ? "停用這個供應器" : "啟用這個供應器"}
                    >
                      <span className="binding-toggle-track" aria-hidden="true">
                        <span className="binding-toggle-thumb" />
                      </span>
                      <span>{card.binding?.isActive ? "啟用中" : "已停用"}</span>
                    </button>
                  </div>
                  <p className="variant-copy" style={{ marginBottom: 12 }}>{card.hint}</p>
                  <div className="summary-card summary-card-highlight" style={{ marginBottom: 14 }}>
                    <p className="panel-desc" style={{ marginBottom: 8 }}>讀取到的帳號</p>
                    <strong className="binding-model-value">
                      {getBindingLabel(card.binding)}
                    </strong>
                    <div className="chip-row" style={{ marginTop: 10 }}>
                      <span className="chip">{card.binding?.source ?? "NONE"}</span>
                      <span className={`chip binding-light binding-light-${getStatusLight(card.binding)}`}>
                        <span className="binding-status-dot" aria-hidden="true" />
                        {card.binding?.status === "READY"
                          ? "綁定已就緒"
                          : card.binding?.status === "DISABLED"
                            ? "已停用"
                            : card.binding?.status === "ERROR"
                              ? "需修正"
                              : "待設定"}
                      </span>
                    </div>
                  </div>
                  <div className="summary-card summary-card-highlight" style={{ marginBottom: 14 }}>
                    <p className="panel-desc" style={{ marginBottom: 8 }}>功能選單</p>
                    <div className="binding-action-grid">
                      {BINDING_ACTION_OPTIONS.map((option) => {
                        const active = bindingActions[card.provider] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`binding-action-button binding-action-button-${option.tone} ${active ? "binding-action-button-active" : ""}`}
                            onClick={() => {
                              const nextAction = option.value as BindingAction;
                              setBindingActions((current) => ({
                                ...current,
                                [card.provider]: nextAction
                              }));
                              updateBindingFeedback(
                                card.provider,
                                option.tone,
                                `已切換功能：${option.label}。${option.description}`
                              );
                            }}
                          >
                            <span className="binding-action-icon" aria-hidden="true">{option.icon}</span>
                            <span className="binding-action-text">
                              <strong>{option.label}</strong>
                              <small>{option.description}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <label className="field">
                        <span className="label">模型選擇</span>
                        <select
                          className="select"
                          value={card.modelValue}
                          disabled={card.binding?.status === "READY" || !card.binding?.isActive}
                          onChange={(event) => {
                            card.setModel(event.target.value);
                            updateBindingFeedback(card.provider, "info", `已切換預設模型：${event.target.value}`);
                          }}
                        >
                          {card.modelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="helper-text" style={{ marginTop: 8 }}>
                          {card.binding?.status === "READY"
                            ? "已綁定時會鎖定模型；如需更換請先解除綁定。"
                            : card.binding?.status === "DISABLED"
                              ? "已停用時無法切換模型，請先啟用供應器。"
                              : "尚未綁定時可自由切換模型。"}
                        </p>
                      </label>
                      <div className="field">
                        <span className="label">目前功能</span>
                        <div className="summary-card" style={{ minHeight: 58, display: "grid", alignItems: "center" }}>
                          <strong className="summary-title" style={{ margin: 0 }}>
                            {getActionOption(bindingActions[card.provider]).label}
                          </strong>
                        </div>
                        <span className="label" style={{ marginTop: 10 }}>目前模型提示</span>
                        <div className="summary-card" style={{ minHeight: 58, display: "grid", alignItems: "center" }}>
                          <strong className="summary-title" style={{ margin: 0 }}>
                            {card.binding?.status === "READY"
                              ? `${card.binding.defaultModel ?? card.modelPlaceholder}（已鎖定）`
                              : card.binding?.status === "DISABLED"
                                ? `${card.binding.defaultModel ?? card.modelPlaceholder}（已停用）`
                                : card.modelValue || card.modelPlaceholder}
                          </strong>
                        </div>
                      </div>
                    </div>
                    <p className="helper-text" style={{ marginTop: 10 }}>
                      點上方功能即可切換，下方按「執行功能」會依目前選擇自動執行並回饋狀態。
                    </p>
                  </div>
                  <div className="stack" style={{ gap: 12 }}>
                    <label className="field">
                      <span className="label">API Key</span>
                      <input
                        className="input"
                        type="password"
                        value={card.keyValue}
                        onChange={(event) => card.setKey(event.target.value)}
                        placeholder={card.placeholder}
                      />
                    </label>
                  </div>
                  <div className="toolbar" style={{ marginTop: 16, flexWrap: "wrap" }}>
                    <button className="btn" type="button" onClick={() => runBindingAction(card.provider)} disabled={bindingLoading[card.provider] || bindingLoading[`${card.provider}-test`] || bindingLoading[`${card.provider}-delete`]}>
                      {bindingLoading[card.provider] || bindingLoading[`${card.provider}-test`] || bindingLoading[`${card.provider}-delete`]
                        ? "執行中..."
                        : "執行功能"}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => saveBinding(card.provider)} disabled={bindingLoading[card.provider]}>
                      {bindingLoading[card.provider] ? "綁定中..." : "儲存綁定"}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => testBinding(card.provider)} disabled={bindingLoading[`${card.provider}-test`]}>
                      {bindingLoading[`${card.provider}-test`] ? "測試中..." : "測試連線"}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => disconnectBinding(card.provider)} disabled={bindingLoading[`${card.provider}-delete`]}>
                      {bindingLoading[`${card.provider}-delete`] ? "解除中..." : "解除綁定"}
                    </button>
                  </div>
                  <div className="chip-row" style={{ marginTop: 14 }}>
                    <span className="chip">{card.binding?.source ?? "NONE"}</span>
                    <span className="chip">{card.binding?.defaultModel ?? card.modelPlaceholder}</span>
                    <span className="chip">{card.binding?.lastVerifiedAt ? new Date(card.binding.lastVerifiedAt).toLocaleString("zh-TW") : "尚未測試"}</span>
                  </div>
                  {bindingFeedback[card.provider] ? (
                    <div className={`binding-feedback-card binding-feedback-${bindingFeedback[card.provider].tone}`} style={{ marginTop: 14 }}>
                      <p className="panel-desc" style={{ marginBottom: 6 }}>功能回饋</p>
                      <p className="summary-title" style={{ color: bindingFeedback[card.provider].tone === "danger" ? "var(--danger)" : undefined }}>
                        {bindingFeedback[card.provider].message}
                      </p>
                    </div>
                  ) : null}
                  {card.binding?.lastError ? <p className="subtle" style={{ color: "var(--danger)", marginTop: 10 }}>{card.binding.lastError}</p> : null}
                </article>
              ))}
            </div>
              </div>
            </div>
          </div>
        </section>

        <div className="page-grid">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">選中內容腳本</h2>
                  <p className="panel-desc">直接預覽腳本段落，方便切換生成不同版本影片。</p>
                </div>
              </div>
              {selectedContent ? (
                <div className="variant-list">
                  {selectedContent.scripts.map((script) => (
                    <article key={script.id} className="variant-card">
                      <div className="panel-header" style={{ marginBottom: 8 }}>
                        <h3 className="variant-title">{script.title}</h3>
                        <button type="button" className="chip" onClick={() => setSelectedScriptId(script.id)}>
                          選用
                        </button>
                      </div>
                      <p className="variant-copy">{script.payload.hook}</p>
                      <p className="panel-desc">{script.payload.middle}</p>
                      <p className="panel-desc">{script.payload.cta}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">最近影片</h2>
                  <p className="panel-desc">專案與輸出結果可直接回看。</p>
                </div>
              </div>
              <div className="list">
                {videos.map((video) => (
                  <article key={video.id} className="list-item">
                    <div className="panel-header" style={{ marginBottom: 8 }}>
                      <h3 className="list-title">{video.content.productName}</h3>
                      <span className="status status-muted">{video.style}</span>
                    </div>
                    <div className="chip-row" style={{ marginBottom: 8 }}>
                      <span className="chip">{video.mediaMode}</span>
                      <span className="chip">{video.status}</span>
                    </div>
                    <p className="list-subtitle">
                      {video.durationSeconds}s · {video.status}
                    </p>
                    {video.output ? <p className="list-subtitle">輸出：{video.output.publicUrl ?? video.output.filePath}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
