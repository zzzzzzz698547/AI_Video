import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { HandoffInput, HandoffReason, EscalationSeverity, IntentClassification, LeadScoreSnapshot, KnowledgeRetrievalResult } from "./chat.types";

@Injectable()
export class HandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(input: {
    conversation: { id: string; workspaceId: string; brandId?: string | null; leadId?: string | null; customerProfileId?: string | null; salesStage?: string };
    intent: IntentClassification;
    leadScore: LeadScoreSnapshot;
    knowledge: KnowledgeRetrievalResult;
    message: string;
  }) {
    const uncertainty = input.intent.confidence < 0.5 || input.knowledge.answer === "我先幫你確認一下這個問題，避免跟你說錯。";
    const complaint = input.intent.label === "COMPLAINT";
    const hotLead = input.leadScore.temperature === "HOT" && input.leadScore.score >= 88;
    const prohibited = input.knowledge.guardrails.length > 0;

    const shouldHandoff = complaint || prohibited || uncertainty || hotLead;
    const reason = complaint
      ? "客訴或負評訊號"
      : prohibited
        ? "知識庫命中限制內容"
        : uncertainty
          ? "AI 無法確定答案"
          : hotLead
            ? "高意向高價值客戶"
            : "無需接手";

    return {
      shouldHandoff,
      reason: shouldHandoff ? this.reasonToCode(reason) : undefined,
      reasonText: reason,
      severity: this.resolveSeverity(complaint, prohibited, hotLead, uncertainty)
    };
  }

  async requestHandoff(conversationId: string, input: HandoffInput) {
    const conversation = await (this.prisma as any).conversation.findUnique({
      where: { id: conversationId }
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const log = await (this.prisma as any).handoffLog.create({
      data: {
        workspaceId: conversation.workspaceId,
        brandId: conversation.brandId ?? null,
        leadId: conversation.leadId ?? null,
        conversationId,
        customerProfileId: conversation.customerProfileId ?? null,
        status: "REQUESTED",
        severity: input.severity ?? "MEDIUM",
        reason: input.reason ?? "MANUAL",
        assignedToUserId: input.assignedToUserId ?? null,
        note: input.note ?? null,
        openedAt: new Date()
      }
    });

    await (this.prisma as any).conversation.update({
      where: { id: conversationId },
      data: {
        handoffStatus: "REQUESTED",
        humanHandled: false,
        aiHandled: false,
        status: "PENDING"
      }
    });

    return log;
  }

  buildHandoffReply(input: {
    intent: IntentClassification;
    leadScore: LeadScoreSnapshot;
    knowledge: KnowledgeRetrievalResult;
    note?: string;
  }) {
    if (input.intent.label === "COMPLAINT") {
      return "我先幫你轉真人接手，避免資訊不完整。";
    }
    if (input.leadScore.temperature === "HOT") {
      return "這筆我先幫你轉給真人快速接手，讓你更快確認到位。";
    }
    return input.note ? `我先幫你轉給真人：${input.note}` : "我先幫你轉給真人接手。";
  }

  private resolveSeverity(complaint: boolean, prohibited: boolean, hotLead: boolean, uncertainty: boolean): EscalationSeverity {
    if (complaint || prohibited) {
      return "CRITICAL";
    }
    if (hotLead) {
      return "HIGH";
    }
    if (uncertainty) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private reasonToCode(reason: string): HandoffReason {
    if (reason.includes("客訴")) {
      return "COMPLAINT";
    }
    if (reason.includes("限制")) {
      return "COMPLIANCE";
    }
    if (reason.includes("AI 無法確定")) {
      return "UNCERTAIN_ANSWER";
    }
    if (reason.includes("高意向")) {
      return "HIGH_VALUE";
    }
    return "MANUAL";
  }
}

