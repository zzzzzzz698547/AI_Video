"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import { CopyButton } from "../../components/copy-button";
import { OptionPicker } from "../../components/option-picker";
import { readTenantSession, type TenantSession } from "../../lib/tenant-session";

type VideoItem = {
  id: string;
  title: string;
  status: string;
  style: string;
  durationSeconds: number;
  output: { id: string; filePath: string; publicUrl: string | null } | null;
  content: { id: string; productName: string };
};

type ContentItem = {
  id: string;
  request: {
    productName: string;
  };
  posts: Array<{
    id: string;
    title: string;
    payload: {
      copy?: string;
    };
    hashtags: string[];
  }>;
  scripts: Array<{
    id: string;
    title: string;
    payload: {
      hook?: string;
      middle?: string;
      cta?: string;
    };
    hashtags: string[];
  }>;
};

type PublishJob = {
  id: string;
  sourceType: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  publishAt: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  queueItem: {
    queueState: string;
    scheduledFor: string | null;
  } | null;
  logs: Array<{
    id: string;
    platform: string;
    action: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

type SelectedSource = {
  type: "VIDEO_OUTPUT" | "CONTENT_VARIANT";
  id: string;
};

const PLATFORM_OPTIONS = ["FACEBOOK", "INSTAGRAM", "THREADS", "YOUTUBE"] as const;

export default function PublishingCenterPage() {
  const [tenantSession, setTenantSession] = useState<TenantSession | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [sourceType, setSourceType] = useState<SelectedSource["type"]>("VIDEO_OUTPUT");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["FACEBOOK", "INSTAGRAM", "THREADS"]);
  const [publishAt, setPublishAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTenantSession(readTenantSession());
    void loadData();
  }, []);

  async function loadData() {
    const session = readTenantSession();
    const tenantQuery = session?.tenantId ? `&tenantId=${encodeURIComponent(session.tenantId)}` : "";
    const [videoItems, contentItems, jobItems] = await Promise.all([
      apiFetch<VideoItem[]>(`/videos?take=20${tenantQuery}`),
      apiFetch<ContentItem[]>(`/contents?take=20${tenantQuery}`),
      apiFetch<PublishJob[]>(`/publishes?take=20${tenantQuery}`)
    ]);
    setVideos(videoItems);
    setContents(contentItems);
    setJobs(jobItems);
    if (!selectedSourceId) {
      const firstVideoWithOutput = videoItems.find((item) => item.output?.id);
      if (firstVideoWithOutput?.output?.id) {
        setSelectedSourceId(firstVideoWithOutput.output.id);
      } else if (contentItems[0]) {
        setSelectedSourceId(contentItems[0].posts[0]?.id ?? contentItems[0].scripts[0]?.id ?? contentItems[0].id);
      }
    }
  }

  const selectedVideo = useMemo(
    () => videos.find((item) => item.output?.id === selectedSourceId || item.id === selectedSourceId) ?? null,
    [selectedSourceId, videos]
  );

  const selectedContent = useMemo(
    () => contents.find((item) => item.posts.some((post) => post.id === selectedSourceId) || item.scripts.some((script) => script.id === selectedSourceId)) ?? null,
    [contents, selectedSourceId]
  );

  useEffect(() => {
    if (sourceType === "VIDEO_OUTPUT" && selectedVideo && !caption) {
      setCaption(`看看 ${selectedVideo.content.productName} 的重點影片。`);
      setHashtags("#品牌行銷 #短影音 #社群內容");
    }
    if (sourceType === "CONTENT_VARIANT" && selectedContent && !caption) {
      const sample = selectedContent.posts[0]?.payload.copy ?? selectedContent.scripts[0]?.payload.hook ?? "";
      setCaption(sample);
      setHashtags(selectedContent.posts[0]?.hashtags.join(" ") ?? selectedContent.scripts[0]?.hashtags.join(" ") ?? "");
    }
  }, [caption, selectedContent, selectedVideo, sourceType]);

  async function handlePublish() {
    setLoading(true);
    setError(null);

    try {
      const normalizedHashtags = hashtags
        .split(/[\n,，\s]+/g)
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        tenantId: tenantSession?.tenantId,
        sourceType,
        videoOutputId: sourceType === "VIDEO_OUTPUT" ? selectedSourceId : undefined,
        contentVariantId: sourceType === "CONTENT_VARIANT" ? selectedSourceId : undefined,
        caption,
        hashtags: normalizedHashtags,
        platforms,
        publishAt: publishAt || undefined
      };

      await apiFetch<PublishJob>("/publish", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "發佈失敗");
    } finally {
      setLoading(false);
    }
  }

  async function retryJob(id: string) {
    await apiFetch<PublishJob>(`/retry/${id}`, { method: "POST" });
    await loadData();
  }

  const selectedOptions =
    sourceType === "VIDEO_OUTPUT"
      ? videos
          .filter((video) => Boolean(video.output?.id))
          .map((video) => ({
            id: video.output?.id ?? video.id,
            label: `${video.content.productName} · ${video.durationSeconds}s`
          }))
      : contents.flatMap((content) => [
          ...content.posts.map((post) => ({ id: post.id, label: `${content.request.productName} · 貼文 ${post.title}` })),
          ...content.scripts.map((script) => ({ id: script.id, label: `${content.request.productName} · 腳本 ${script.title}` }))
        ]);

  const selectedJob = jobs[0] ?? null;

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">Publishing Center</p>
          <h1 className="title">多平台自動發佈系統</h1>
          <p className="subtle">
            這裡負責把影片或文案推到 Facebook、Instagram、Threads、YouTube，任務支援排程、重試與狀態追蹤。
          </p>
        </div>
        {tenantSession ? <div className="status status-muted">{tenantSession.tenantName} · {tenantSession.workspaceName}</div> : null}
        <div className="status status-processing">Queue · Retry · Schedule</div>
      </header>

      <div className="page-grid">
        <section className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">發佈設定</h2>
                <p className="panel-desc">先選來源、再選平台與時間，系統會建立 publishing_job 並進 queue。</p>
              </div>
              {loading ? <span className="status status-processing">送出中</span> : <span className="status status-success">待發佈</span>}
            </div>

            <div className="stack">
              <div className="toolbar">
                {(["VIDEO_OUTPUT", "CONTENT_VARIANT"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${sourceType === value ? "chip-active" : ""}`}
                    onClick={() => {
                      setSourceType(value);
                      setSelectedSourceId("");
                    }}
                  >
                    {value === "VIDEO_OUTPUT" ? "影片" : "文案"}
                  </button>
                ))}
              </div>

              <OptionPicker
                label="選擇內容"
                value={selectedSourceId}
                options={selectedOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                  description: sourceType === "VIDEO_OUTPUT" ? "影片輸出" : "內容文案"
                }))}
                onChange={(value) => setSelectedSourceId(value)}
                helperText="來源內容會直接展開顯示，不用再點選下拉。"
              />

              <label className="field">
                <span className="label">發佈文案</span>
                <textarea className="textarea" value={caption} onChange={(event) => setCaption(event.target.value)} />
              </label>

              <label className="field">
                <span className="label">Hashtags</span>
                <textarea className="textarea" value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
              </label>

              <div className="field">
                <span className="label">發佈平台</span>
                <div className="toolbar">
                  {PLATFORM_OPTIONS.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className={`chip ${platforms.includes(platform) ? "chip-active" : ""}`}
                      onClick={() =>
                        setPlatforms((current) =>
                          current.includes(platform)
                            ? current.filter((item) => item !== platform)
                            : [...current, platform]
                        )
                      }
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="label">發佈時間</span>
                <input className="input" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
              </label>

              <div className="toolbar">
                <button className="btn" type="button" onClick={handlePublish} disabled={loading || !selectedSourceId}>
                  {loading ? "建立任務..." : "建立發佈任務"}
                </button>
                <span className="status status-muted">支援排程、重試與狀態追蹤</span>
              </div>

              {error ? <p className="subtle" style={{ color: "var(--danger)" }}>{error}</p> : null}
            </div>
          </div>
        </section>

        <aside className="stack">
          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">最新任務</h2>
                  <p className="panel-desc">成功、失敗、排程中都會保留 log 與 API 回應。</p>
                </div>
              </div>

              {selectedJob ? (
                <div className="variant-card">
                  <div className="panel-header" style={{ marginBottom: 8 }}>
                    <h3 className="variant-title">{selectedJob.id}</h3>
                    <span className={`status ${selectedJob.status === "FAILED" ? "status-failed" : selectedJob.status === "SUCCESS" ? "status-success" : "status-scheduled"}`}>
                      {selectedJob.status}
                    </span>
                  </div>
                  <p className="variant-copy">{selectedJob.caption}</p>
                  <div className="meta-row">
                    {selectedJob.platforms.map((platform) => (
                      <span key={platform} className="meta">
                        {platform}
                      </span>
                    ))}
                  </div>
                  <div className="toolbar" style={{ marginTop: 14 }}>
                    <CopyButton text={selectedJob.caption} label="複製文案" />
                    {selectedJob.status === "FAILED" ? (
                      <button type="button" className="btn btn-secondary" onClick={() => retryJob(selectedJob.id)}>
                        重試
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-inner">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">任務列表</h2>
                  <p className="panel-desc">平台狀態以不同顏色區分，方便快速看 queue 狀況。</p>
                </div>
              </div>
              <div className="list">
                {jobs.map((job) => (
                  <article key={job.id} className="list-item">
                    <div className="panel-header" style={{ marginBottom: 8 }}>
                      <h3 className="list-title">{job.id.slice(0, 8)}</h3>
                      <span className={`status ${job.status === "FAILED" ? "status-failed" : job.status === "SUCCESS" ? "status-success" : job.status === "SCHEDULED" ? "status-scheduled" : "status-processing"}`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="list-subtitle">{job.caption.slice(0, 100)}{job.caption.length > 100 ? "…" : ""}</p>
                    <p className="list-subtitle">
                      {job.platforms.join(" / ")} · {job.queueItem?.queueState ?? "no-queue"}
                    </p>
                    {job.errorMessage ? <p className="list-subtitle" style={{ color: "var(--danger)" }}>{job.errorMessage}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-inner">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">平台 adapter 觀察</h2>
              <p className="panel-desc">目前先用官方 API 介面的 mock layer，憑證補上後只需要替換 adapter 內部實作。</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>平台</th>
                <th>來源</th>
                <th>排程 / 即時</th>
                <th>重試</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Facebook Page", "VIDEO_OUTPUT / CONTENT_VARIANT", "BullMQ / Cron", "Exponential backoff"],
                ["Instagram Pro", "VIDEO_OUTPUT / CONTENT_VARIANT", "BullMQ / Cron", "Exponential backoff"],
                ["Threads", "CONTENT_VARIANT", "BullMQ / Cron", "Exponential backoff"],
                ["YouTube", "VIDEO_OUTPUT", "BullMQ / Cron", "Exponential backoff"]
              ].map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
