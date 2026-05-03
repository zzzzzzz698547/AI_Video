import type { Metadata } from "next";
import "./globals.css";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { AppChrome } from "../components/app-chrome";
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
          <AppChrome navItems={navItems}>{children}</AppChrome>
        </TenantGate>
      </body>
    </html>
  );
}
