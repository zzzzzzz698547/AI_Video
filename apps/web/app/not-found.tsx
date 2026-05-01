import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-inner">
          <h1 className="panel-title">找不到頁面</h1>
          <p className="panel-desc">你前往的內容不存在或已被移動。</p>
          <div className="toolbar" style={{ marginTop: 16 }}>
            <Link className="btn" href="/">
              回到首頁
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
