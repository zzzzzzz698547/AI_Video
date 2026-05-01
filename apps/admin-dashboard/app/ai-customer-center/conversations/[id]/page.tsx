export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

const conversationMessages = [
  { side: "customer", text: "這個有現貨嗎？價格大概多少？" },
  { side: "ai", text: "有的，我先幫你確認一下現貨與價格。你如果告訴我預算，我可以直接幫你縮小到最適合的款式。" },
  { side: "customer", text: "預算大概 3000 左右。" },
  { side: "ai", text: "收到，我幫你整理 3000 內的推薦清單。要不要我順手幫你發一份可直接下單的方案？" }
];

const profileItems = [
  ["來源平台", "Instagram"],
  ["意圖", "詢價"],
  ["Lead 分數", "86 / HOT"],
  ["銷售階段", "價格討論"],
  ["下一步", "發價格表"],
  ["是否轉人工", "否"]
];

export default function ConversationDetailPage({ params }: PageProps) {
  const { id } = params;

  return (
    <div className="chat-shell">
      <header className="chat-hero">
        <p className="eyebrow">對話詳情</p>
        <h1 className="title">{id}</h1>
        <p className="subtle">左側是完整對話紀錄，右側顯示客戶資料、意圖、Lead 分數、銷售階段與建議下一步。</p>
      </header>

      <section className="chat-layout">
        <article className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">聊天紀錄</h2>
                <p className="panel-desc">AI 先接住問題，再往成交推進。</p>
              </div>
              <div className="toolbar">
                <button className="btn btn-secondary" type="button">
                  轉人工
                </button>
                <button className="btn" type="button">
                  標記高意向
                </button>
              </div>
            </div>

            <div className="message-thread">
              {conversationMessages.map((message) => (
                <div key={message.text} className={`message-row ${message.side}`}>
                  <div className="message-bubble">{message.text}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="stack">
          <article className="panel">
            <div className="panel-inner">
              <h2 className="panel-title">客戶資料與狀態</h2>
              <div className="inspector-list" style={{ marginTop: 12 }}>
                {profileItems.map(([label, value]) => (
                  <div key={label} className="inspector-item">
                    <p className="muted">{label}</p>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-inner">
              <h2 className="panel-title">建議下一步</h2>
              <div className="badge-row" style={{ marginTop: 12 }}>
                {["發價格表", "邀請填表", "推優惠方案", "引導加 LINE"].map((item) => (
                  <span key={item} className="badge">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
