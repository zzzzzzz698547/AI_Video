import { apiFetch } from "../../../lib/api";

type LandingPagePayload = {
  id: string;
  slug: string;
  variantKey: string;
  status: string;
  title: string;
  heroTitle: string;
  heroSubtitle: string;
  painPoints: string[];
  benefits: string[];
  ctaLabel: string;
  formFields: string[];
  sections: unknown;
  metadata: unknown;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ variant?: string }>;
};

export default async function LandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { variant } = (await searchParams) ?? {};

  let page: LandingPagePayload | null = null;
  try {
    const response = await apiFetch<ApiEnvelope<LandingPagePayload | null>>(
      `/landing/${slug}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`
    );
    page = response.data;
  } catch {
    page = null;
  }

  const fallback = {
    title: "預設轉換頁",
    heroTitle: "把流量變名單，再把名單變成交",
    heroSubtitle: "這是一個動態 Landing Page 預覽，實際內容會由 funnel module 根據商品與 A/B 版本輸出。",
    painPoints: ["沒有追蹤連結", "沒有表單", "沒有跟進"],
    benefits: ["轉單閉環", "自動跟進", "成交追蹤"],
    ctaLabel: "立即填單",
    formFields: ["name", "phone", "lineId"]
  };

  const data = page ?? fallback;

  return (
    <main className="min-h-screen bg-[#050816] text-[#e5eefc]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 lg:flex-row lg:items-center lg:gap-14">
        <div className="max-w-2xl space-y-6">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.25em] text-[#8ea0bf] uppercase">
            {page?.slug ?? slug} · {page?.variantKey ?? "default"}
          </span>
          <h1 className="font-semibold tracking-[-0.04em] text-5xl leading-tight lg:text-7xl">{data.heroTitle}</h1>
          <p className="max-w-xl text-lg leading-8 text-[#8ea0bf]">{data.heroSubtitle}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.painPoints.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-[#8ea0bf]">痛點</p>
                <p className="mt-2 font-medium">{item}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {data.benefits.map((item) => (
              <span key={item} className="rounded-full bg-[#59d7ff]/15 px-4 py-2 text-sm text-[#b8d7ff]">
                {item}
              </span>
            ))}
          </div>
        </div>

        <aside className="mt-10 w-full max-w-md rounded-[28px] border border-white/10 bg-[#0b1223]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:mt-0">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-[#59d7ff]">Lead Form</p>
            <h2 className="text-2xl font-semibold">{data.title}</h2>
          </div>

          <form className="mt-6 grid gap-4">
            {["name", "phone", "lineId"].map((field) => (
              <label key={field} className="grid gap-2">
                <span className="text-sm text-[#8ea0bf]">{field}</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[#e5eefc] outline-none placeholder:text-[#5f708f]"
                  placeholder={`輸入 ${field}`}
                />
              </label>
            ))}
            <button
              type="button"
              className="rounded-2xl bg-[#59d7ff] px-4 py-4 font-semibold text-[#040816] transition hover:brightness-110"
            >
              {data.ctaLabel}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-[#8ea0bf]">可用欄位</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.formFields.map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#b8d7ff]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
