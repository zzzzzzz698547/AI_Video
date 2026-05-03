"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminSessionBar } from "./admin-session-bar";

type NavItem = {
  href: string;
  label: string;
};

type AdminChromeProps = {
  navItems: NavItem[];
  children: ReactNode;
};

export function AdminChrome({ navItems, children }: AdminChromeProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className={`dashboard ${isOpen ? "dashboard-nav-open" : ""}`}>
      <button className="mobile-nav-toggle" type="button" onClick={() => setIsOpen(true)} aria-label="開啟管理導覽">
        <span />
        <span />
        <span />
      </button>
      <button
        className={`mobile-nav-overlay ${isOpen ? "mobile-nav-overlay-open" : ""}`}
        type="button"
        onClick={() => setIsOpen(false)}
        aria-label="關閉管理導覽"
      />
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-mobile-header">
          <div className="brand">AI-VIDIO</div>
          <button className="mobile-nav-close" type="button" onClick={() => setIsOpen(false)} aria-label="關閉選單">
            ×
          </button>
        </div>
        <div className="brand sidebar-desktop-brand">AI-VIDIO</div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">
        <AdminSessionBar />
        {children}
      </main>
    </div>
  );
}
