import { Injectable } from "@nestjs/common";
import { AiOrchestratorService } from "../../core/ai/ai-orchestrator.service";
import type { ChatStyle, ChatTone, IntentClassification, KnowledgeRetrievalResult, LeadScoreSnapshot } from "./chat.types";

@Injectable()
export class SalesAssistantService {
  constructor(private readonly aiOrchestrator: AiOrchestratorService) {}

  async composeReply(input: {
    workspaceId: string;
    brandId?: string;
    conversation: { id: string; salesStage?: string; assistantTone?: string | null; assistantStyle?: string | null };
    intent: IntentClassification;
    leadScore: LeadScoreSnapshot;
    knowledge: KnowledgeRetrievalResult;
    tone?: ChatTone;
    style?: ChatStyle;
  }) {
    const tone = input.tone ?? (input.conversation.assistantTone as ChatTone | undefined) ?? this.defaultTone(input.intent.label);
    const style = input.style ?? (input.conversation.assistantStyle as ChatStyle | undefined) ?? "high_conversion";
    const promptVersion = "chat-01";

    try {
      const result = await this.aiOrchestrator.generate({
        module: "chat",
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        tone,
        style,
        input: {
          conversationId: input.conversation.id,
          intent: input.intent,
          leadScore: input.leadScore,
          knowledge: input.knowledge
        }
      });

      const replyText = typeof result.output === "string" ? result.output : this.buildFallbackReply(input.intent.label, input.knowledge.answer, input.leadScore.recommendedNextAction);
      return {
        replyText,
        provider: result.provider,
        model: result.model,
        promptVersion,
        tone,
        style,
        safetyStatus: "SAFE",
        tokenUsage: { costUsd: result.costUsd },
        metadata: {
          source: "ai-orchestrator",
          promptVersion
        }
      };
    } catch {
      return {
        replyText: this.buildFallbackReply(input.intent.label, input.knowledge.answer, input.leadScore.recommendedNextAction),
        provider: "fallback",
        model: "rules-based",
        promptVersion,
        tone,
        style,
        safetyStatus: input.intent.label === "COMPLAINT" ? "REVIEW_REQUIRED" : "SAFE",
        tokenUsage: { costUsd: 0 },
        metadata: {
          source: "fallback",
          promptVersion
        }
      };
    }
  }

  private defaultTone(label: IntentClassification["label"]): ChatTone {
    if (label === "COMPLAINT") {
      return "professional";
    }
    if (label === "HIGH_BUY_INTENT") {
      return "sales";
    }
    return "friendly";
  }

  private buildFallbackReply(label: IntentClassification["label"], answer: string, nextAction: string) {
    const closing = this.buildCTA(nextAction);
    if (label === "COMPLAINT") {
      return `先跟你說聲抱歉，我這邊先幫你確認。\n\n${answer}\n\n${closing}`;
    }
    return `${answer}\n\n${closing}`;
  }

  private buildCTA(nextAction: string) {
    switch (nextAction) {
      case "SEND_PRICE_LIST":
        return "如果你要，我可以直接幫你整理價格表給你。";
      case "SEND_RECOMMENDATION_LIST":
        return "要不要我直接幫你配一套適合你的方案？";
      case "INVITE_TO_FORM":
        return "如果你方便，我可以先幫你整理一份表單，讓我們更快對上需求。";
      case "INVITE_TO_LINE":
        return "你也可以直接加 LINE，我幫你快速確認細節。";
      case "TRANSFER_TO_HUMAN":
        return "我先幫你轉給真人接手，讓你直接處理得更快。";
      case "SEND_OFFER":
        return "如果你要，我可以順手把適合你的優惠一起整理給你。";
      case "AFTER_SALES_FOLLOW_UP":
        return "後續如果需要售後或加購，我也可以一起幫你安排。";
      case "ASK_CLARIFYING_QUESTION":
      default:
        return "如果你願意多給我一點需求，我可以直接幫你縮小選擇。";
    }
  }
}

