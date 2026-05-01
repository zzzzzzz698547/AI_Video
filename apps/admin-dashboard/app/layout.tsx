import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import type { ReactNode } from "react";
import { TenantGate } from "../components/tenant-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI-VIDIO 後台管理中心",
  description: "AI-VIDIO 核心架構後台"
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="dashboard">
          <aside className="sidebar">
            <div className="brand">AI-VIDIO</div>
            <nav className="nav">
              <Link href="/license-center">授權中心</Link>
              <Link href="/">核心架構</Link>
              <Link href="/integrations">社群綁定</Link>
              <Link href="/analytics">數據分析中心</Link>
              <Link href="/funnel-center">轉單中心</Link>
              <Link href="/ai-customer-center">AI 客服中心</Link>
              <Link href="/?section=modules">模組總覽</Link>
              <Link href="/?section=queues">任務佇列</Link>
            </nav>
          </aside>
          <main className="content">
            <TenantGate>{children}</TenantGate>
          </main>
        </div>
      </body>
    </html>
  );
}
