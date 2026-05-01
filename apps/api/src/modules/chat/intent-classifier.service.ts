import { Injectable } from "@nestjs/common";
import type { IntentClassification } from "./chat.types";

type IntentKeywordRule = {
  label: IntentClassification["label"];
  keywords: string[];
  confidence: number;
  reasoning: string;
};

const INTENT_RULES: IntentKeywordRule[] = [
  { label: "COMPLAINT", keywords: ["客訴", "爛", "退貨", "騙", "負評", "爛透", "不滿", "詐騙"], confidence: 0.95, reasoning: "偵測到高風險或抱怨語句" },
  { label: "ASK_PRICE", keywords: ["價格", "價錢", "多少", "報價", "費用", "幾錢"], confidence: 0.92, reasoning: "詢價意圖明確" },
  { label: "ASK_STOCK", keywords: ["有貨", "庫存", "現貨", "還有嗎", "缺貨"], confidence: 0.9, reasoning: "詢問庫存或供應狀態" },
  { label: "ASK_PAYMENT", keywords: ["付款", "刷卡", "分期", "轉帳", "匯款", "運費", "配送"], confidence: 0.88, reasoning: "詢問付款或運送方式" },
  { label: "ASK_INSTALLATION", keywords: ["安裝", "怎麼用", "使用方式", "教學", "設定", "保固"], confidence: 0.86, reasoning: "詢問安裝或操作方式" },
  { label: "COMPARE_PRODUCTS", keywords: ["比較", "差別", "哪個好", "推薦", "方案"], confidence: 0.84, reasoning: "想比較不同商品或方案" },
  { label: "HIGH_BUY_INTENT", keywords: ["直接買", "下單", "怎麼買", "我要買", "可以訂", "立即"], confidence: 0.93, reasoning: "高意向購買訊號" },
  { label: "AFTER_SALES", keywords: ["售後", "維修", "保固", "退換", "客服", "故障"], confidence: 0.9, reasoning: "售後服務或保固問題" },
  { label: "JUST_BROWSING", keywords: ["看看", "了解", "想問", "先問", "好奇"], confidence: 0.68, reasoning: "暫時較像隨便問問或探索" }
];

@Injectable()
export class IntentClassifierService {
  classify(
    message: string,
    context?: {
      history?: Array<{ content: string }>;
      customerName?: string | null;
      conversation?: unknown;
      customerProfile?: unknown;
    }
  ): IntentClassification {
    const normalized = message.toLowerCase();
    const matched = INTENT_RULES.map((rule) => {
      const hitCount = rule.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
      return {
        ...rule,
        hitCount
      };
    })
      .filter((rule) => rule.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount || b.confidence - a.confidence);

    if (message.includes("?") && !matched.length) {
      return {
        label: "UNKNOWN",
        confidence: 0.52,
        reasoning: "句型帶有問題，但無法明確分類",
        matchedKeywords: [],
        signals: {
          hasQuestionMark: true,
          shortMessage: message.length < 12,
          historyCount: context?.history?.length ?? 0
        }
      };
    }

    const top = matched[0];
    if (top) {
      return {
        label: top.label,
        confidence: Math.min(0.99, top.confidence + Math.min(0.08, top.hitCount * 0.03)),
        reasoning: top.reasoning,
        matchedKeywords: top.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())),
        signals: {
          hitCount: top.hitCount,
          historyCount: context?.history?.length ?? 0,
          messageLength: message.length
        }
      };
    }

    return {
      label: message.length < 8 ? "JUST_BROWSING" : "UNKNOWN",
      confidence: message.length < 8 ? 0.6 : 0.48,
      reasoning: message.length < 8 ? "短訊息且缺乏明確購買訊號" : "目前無法從內容推斷明確意圖",
      matchedKeywords: [],
      signals: {
        historyCount: context?.history?.length ?? 0,
        messageLength: message.length
      }
    };
  }
}
