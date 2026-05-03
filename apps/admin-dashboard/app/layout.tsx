import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import { AdminChrome } from "../components/admin-chrome";
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
        <TenantGate>
          <AdminChrome
            navItems={[
              { href: "/login", label: "管理員登入" },
              { href: "/license-center", label: "授權中心" },
              { href: "/", label: "核心架構" },
              { href: "/integrations", label: "社群綁定" },
              { href: "/analytics", label: "數據分析中心" },
              { href: "/funnel-center", label: "轉單中心" },
              { href: "/ai-customer-center", label: "AI 客服中心" },
              { href: "/?section=modules", label: "模組總覽" },
              { href: "/?section=queues", label: "任務佇列" }
            ]}
          >
            {children}
          </AdminChrome>
        </TenantGate>
      </body>
    </html>
  );
}
