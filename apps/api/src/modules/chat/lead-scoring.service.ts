import { Injectable } from "@nestjs/common";
import type { LeadScoreSnapshot, IntentClassification, SalesStage, RecommendedNextAction } from "./chat.types";

const SCORE_RULES: Record<string, number> = {
  ASK_PRICE: 18,
  ASK_SPEC: 12,
  ASK_STOCK: 15,
  ASK_INSTALLATION: 10,
  ASK_PAYMENT: 24,
  COMPARE_PRODUCTS: 14,
  HIGH_BUY_INTENT: 32,
  JUST_BROWSING: -6,
  AFTER_SALES: 8,
  COMPLAINT: 2,
  UNKNOWN: 0
};

@Injectable()
export class LeadScoringService {
  score(input: {
    conversation: { salesStage?: SalesStage; recommendedNextAction?: RecommendedNextAction };
    customerProfile?: { temperature?: string | null };
    intent: IntentClassification;
    message: string;
    history?: Array<{ content: string }>;
  }): LeadScoreSnapshot {
    const lower = input.message.toLowerCase();
    const urgencySignals = ["現在", "今天", "立刻", "馬上", "急", "快", "即刻"].filter((word) => lower.includes(word.toLowerCase()));
    const purchaseSignals = ["怎麼買", "付款", "匯款", "刷卡", "下單", "line", "訂購", "現貨"];
    const purchaseHits = purchaseSignals.filter((word) => lower.includes(word.toLowerCase())).length;
    const depthBonus = Math.min(12, Math.max(0, (input.message.split(" ").length - 3) * 2));

    let score = 32;
    score += SCORE_RULES[input.intent.label] ?? 0;
    score += urgencySignals.length * 6;
    score += purchaseHits * 5;
    score += depthBonus;

    if (input.intent.label === "COMPLAINT") {
      score = Math.min(score, 28);
    }

    if (input.intent.label === "UNKNOWN" && input.message.length > 45) {
      score += 8;
    }

    score = Math.max(0, Math.min(100, score));

    const temperature = score >= 75 ? "HOT" : score >= 40 ? "WARM" : "COLD";
    const stage = this.resolveStage(input.intent.label, score, input.conversation.salesStage);
    const recommendedNextAction = this.resolveAction(input.intent.label, temperature, score);

    return {
      score,
      temperature,
      stage,
      recommendedNextAction,
      reason: this.buildReason(input.intent, urgencySignals.length, purchaseHits, depthBonus, temperature),
      signals: {
        urgencySignals,
        purchaseHits,
        depthBonus,
        historyCount: input.history?.length ?? 0,
        intentConfidence: input.intent.confidence
      }
    };
  }

  private resolveStage(intent: IntentClassification["label"], score: number, currentStage?: SalesStage): SalesStage {
    if (intent === "COMPLAINT") {
      return "AFTER_SALES";
    }
    if (intent === "AFTER_SALES") {
      return "AFTER_SALES";
    }
    if (score >= 90 || intent === "HIGH_BUY_INTENT") {
      return "PAYMENT_PENDING";
    }
    if (score >= 75) {
      return "HIGH_INTENT";
    }
    if (intent === "ASK_PRICE" || intent === "ASK_STOCK") {
      return "PRICE_DISCUSSED";
    }
    if (intent === "COMPARE_PRODUCTS" || intent === "ASK_SPEC") {
      return "CONSIDERING";
    }
    if (currentStage === "PAYMENT_PENDING") {
      return "PAYMENT_PENDING";
    }
    return "INFO_REQUESTED";
  }

  private resolveAction(intent: IntentClassification["label"], temperature: LeadScoreSnapshot["temperature"], score: number): RecommendedNextAction {
    if (intent === "COMPLAINT") {
      return "TRANSFER_TO_HUMAN";
    }
    if (intent === "AFTER_SALES") {
      return "AFTER_SALES_FOLLOW_UP";
    }
    if (score >= 90) {
      return "INVITE_TO_LINE";
    }
    if (temperature === "HOT") {
      return "SEND_OFFER";
    }
    switch (intent) {
      case "ASK_PRICE":
      case "ASK_STOCK":
        return "SEND_PRICE_LIST";
      case "ASK_SPEC":
      case "ASK_INSTALLATION":
      case "COMPARE_PRODUCTS":
        return "SEND_RECOMMENDATION_LIST";
      case "ASK_PAYMENT":
        return "INVITE_TO_FORM";
      case "HIGH_BUY_INTENT":
        return "INVITE_TO_LINE";
      case "JUST_BROWSING":
      case "UNKNOWN":
      default:
        return "ASK_CLARIFYING_QUESTION";
    }
  }

  private buildReason(
    intent: IntentClassification,
    urgencyCount: number,
    purchaseHits: number,
    depthBonus: number,
    temperature: LeadScoreSnapshot["temperature"]
  ) {
    return [
      `意圖：${intent.label}`,
      `信心：${Math.round(intent.confidence * 100)}%`,
      urgencyCount ? `急迫訊號：${urgencyCount}` : null,
      purchaseHits ? `成交訊號：${purchaseHits}` : null,
      depthBonus ? `問題深度加分：${depthBonus}` : null,
      `溫度：${temperature}`
    ]
      .filter(Boolean)
      .join(" / ");
  }
}

