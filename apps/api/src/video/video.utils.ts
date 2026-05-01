import { VideoStyle } from "@prisma/client";

export const VIDEO_STYLE_CONFIG: Record<
  VideoStyle,
  { name: string; colors: [string, string, string]; accent: string; bgmFrequency: number }
> = {
  AUTO: { name: "自動", colors: ["#101828", "#18243d", "#2b3f6b"], accent: "#f9fafb", bgmFrequency: 220 },
  SALES: { name: "帶貨快節奏", colors: ["#111827", "#7f1d1d", "#ea580c"], accent: "#fde68a", bgmFrequency: 180 },
  PREMIUM: { name: "高級質感", colors: ["#0f172a", "#334155", "#e2c48f"], accent: "#f8fafc", bgmFrequency: 150 },
  TECH: { name: "科技感", colors: ["#020617", "#0f766e", "#38bdf8"], accent: "#67e8f9", bgmFrequency: 260 },
  SOCIAL: { name: "社群感", colors: ["#111827", "#7c3aed", "#ec4899"], accent: "#fce7f3", bgmFrequency: 240 }
};

export function clipText(text: string, maxLength = 180) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function secondsForText(text: string, base = 1.8) {
  const words = text.trim().length;
  return Math.max(2, Math.min(8, Math.ceil(words / 18) + base));
}

export function escapeForSrt(text: string) {
  return text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}
