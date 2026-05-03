"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminModeBanner } from "./admin-mode-banner";

type NavItem = {
  href: string;
  label: string;
};

type AppChromeProps = {
  navItems: NavItem[];
  children: ReactNode;
};

export function AppChrome({ navItems, children }: AppChromeProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className={`app-shell ${isOpen ? "app-shell-nav-open" : ""}`}>
      <button className="mobile-nav-toggle" type="button" onClick={() => setIsOpen(true)} aria-label="開啟導覽選單">
        <span />
        <span />
        <span />
      </button>
      <button
        className={`mobile-nav-overlay ${isOpen ? "mobile-nav-overlay-open" : ""}`}
        type="button"
        aria-label="關閉導覽選單"
        onClick={() => setIsOpen(false)}
      />
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-mobile-header">
          <div className="brand">AI-VIDIO</div>
          <button className="mobile-nav-close" type="button" onClick={() => setIsOpen(false)} aria-label="關閉選單">
            ×
          </button>
        </div>
        <div>
          <div className="brand sidebar-desktop-brand">AI-VIDIO</div>
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
  );
}
