import { ContentStyle, ContentVariantType } from "@prisma/client";

export const STYLE_LABELS: Record<ContentStyle, string> = {
  AUTO: "自動判斷",
  HOT_SALE: "熱銷帶貨",
  PREMIUM: "高級品牌",
  HUMOR: "搞笑",
  EDUCATIONAL: "知識型"
};

export const PLATFORM_SETS: Record<ContentVariantType, string[]> = {
  TITLE: ["IG", "Threads", "TikTok", "FB"],
  POST_COPY: ["IG", "Threads", "FB"],
  SCRIPT: ["TikTok", "IG", "Reels"]
};

export function compactText(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function dedupe(list: string[]) {
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))];
}

export function toHashtag(token: string) {
  const cleaned = token
    .replace(/[#\s]+/g, "")
    .replace(/[^\p{L}\p{N}_-]/gu, "");

  return cleaned ? `#${cleaned}` : "";
}

export function parsePriceTier(priceRange?: string | null) {
  if (!priceRange) {
    return "mid";
  }

  const numbers = priceRange.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
  const maxNumber = numbers
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);

  if (maxNumber >= 3000 || /高價|精品|奢|限量|尊爵|頂級/.test(priceRange)) {
    return "high";
  }

  if (maxNumber > 0 && maxNumber <= 800) {
    return "low";
  }

  return "mid";
}

export function splitKeywords(keywords: string[]) {
  return dedupe(
    keywords.flatMap((keyword) =>
      keyword
        .split(/[\s/、,，|]/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}
