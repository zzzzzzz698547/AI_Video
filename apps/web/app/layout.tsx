import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { AdminModeBanner } from "../components/admin-mode-banner";
import { TenantGate } from "../components/tenant-gate";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "AI-VIDIO",
  description: "AI 內容、影片、發布一體化工作台"
};

const navItems = [
  { href: "/license-center", label: "授權中心" },
  { href: "/", label: "內容工作室" },
  { href: "/url-analysis", label: "網址分析" },
  { href: "/video-studio", label: "Video Studio" },
  { href: "/publishing-center", label: "發布中心" },
  { href: "/meta/data-deletion", label: "資料刪除" }
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <TenantGate>
          <div className="app-shell">
            <aside className="sidebar">
              <div>
                <div className="brand">AI-VIDIO</div>
                <p className="sidebar-note">內容生成、影片自動化、社群發布，中台先把工作流跑順。</p>
              </div>
              <nav className="nav-list">
                {navItems.map((item) => (
                  <Link key={item.href} className="nav-link" href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="sidebar-footer">
                <span className="status-dot" />
                <span>Local first · NestJS + Prisma + Next.js</span>
              </div>
            </aside>
            <main className="workspace">
              <AdminModeBanner />
              {children}
            </main>
          </div>
        </TenantGate>
      </body>
    </html>
  );
}
