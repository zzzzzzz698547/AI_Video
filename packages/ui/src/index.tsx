import type { ReactNode } from "react";

export function AppCard({ children }: { children: ReactNode }) {
  return <section className="ui-card">{children}</section>;
}

export function AppButton({ children }: { children: ReactNode }) {
  return <button className="ui-button">{children}</button>;
}

export function AppBadge({ children }: { children: ReactNode }) {
  return <span className="ui-badge">{children}</span>;
}

