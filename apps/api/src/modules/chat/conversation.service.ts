import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ChatMessageInput, ConversationListItem, RecommendedNextAction, SalesStage, HandoffStatus, CustomerTemperature } from "./chat.types";

type AppendMessageInput = {
  workspaceId: string;
  brandId?: string;
  conversationId: string;
  customerProfileId?: string;
  leadId?: string;
  sender: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  channel: string;
  content: string;
  externalMessageId?: string;
  aiReplyLogId?: string;
  intentLabel?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

type SnapshotUpdate = {
  salesStage?: SalesStage;
  recommendedNextAction?: RecommendedNextAction;
  handoffStatus?: HandoffStatus;
  assistantTone?: string;
  assistantStyle?: string;
  lastIntentLabel?: string;
  lastLeadScore?: number;
  aiHandled?: boolean;
  humanHandled?: boolean;
  leadId?: string;
  customerProfileId?: string;
  temperature?: CustomerTemperature;
};

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveConversation(input: ChatMessageInput) {
    const existing = input.conversationId
      ? await (this.prisma as any).conversation.findUnique({ where: { id: input.conversationId } })
      : input.sessionId
        ? await (this.prisma as any).conversation.findFirst({
            where: {
              workspaceId: input.workspaceId,
              sessionId: input.sessionId
            }
          })
        : null;

    if (existing) {
      return existing;
    }

    return (this.prisma as any).conversation.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId ?? null,
        customerProfileId: input.customerProfileId ?? null,
        sessionId: input.sessionId ?? null,
        channel: input.channel,
        status: "OPEN",
        salesStage: "NEW_INQUIRY",
        recommendedNextAction: "ASK_CLARIFYING_QUESTION",
        assistantTone: input.tone ?? null,
        assistantStyle: input.style ?? null,
        aiHandled: true,
        humanHandled: false,
        metadata: input.metadata ?? null
      }
    });
  }

  async resolveCustomerProfile(input: {
    workspaceId: string;
    brandId?: string;
    leadId?: string;
    customerProfileId?: string;
    customerName?: string;
    sourcePlatform?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.customerProfileId) {
      return (this.prisma as any).customerProfile.findUnique({ where: { id: input.customerProfileId } });
    }

    if (input.leadId) {
      const lead = await (this.prisma as any).lead.findUnique({
        where: { id: input.leadId },
        include: { customerProfile: true }
      });
      if (lead?.customerProfile) {
        return lead.customerProfile;
      }
      const created = await (this.prisma as any).customerProfile.create({
        data: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? null,
          name: input.customerName ?? lead?.name ?? null,
          sourcePlatform: lead?.sourcePlatform ?? input.sourcePlatform ?? "UNKNOWN",
          metadata: input.metadata ?? null
        }
      });
      await (this.prisma as any).lead.update({
        where: { id: input.leadId },
        data: { customerProfileId: created.id }
      });
      return created;
    }

    if (input.customerName || input.sourcePlatform) {
      const existing = await (this.prisma as any).customerProfile.findFirst({
        where: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? undefined,
          name: input.customerName ?? undefined
        }
      });
      if (existing) {
        return existing;
      }
    }

    return (this.prisma as any).customerProfile.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        name: input.customerName ?? null,
        sourcePlatform: input.sourcePlatform ?? "UNKNOWN",
        metadata: input.metadata ?? null
      }
    });
  }

  async appendMessage(input: AppendMessageInput) {
    const message = await (this.prisma as any).conversationMessage.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        conversationId: input.conversationId,
        customerProfileId: input.customerProfileId ?? null,
        leadId: input.leadId ?? null,
        sender: input.sender,
        channel: input.channel,
        content: input.content,
        externalMessageId: input.externalMessageId ?? null,
        aiReplyLogId: input.aiReplyLogId ?? null,
        intentLabel: input.intentLabel ?? null,
        score: input.score ?? null,
        metadata: input.metadata ?? null
      }
    });

    await (this.prisma as any).conversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessageAt: new Date(),
        aiHandled: input.sender !== "HUMAN"
      }
    });

    if (input.customerProfileId && input.sender === "CUSTOMER") {
      await (this.prisma as any).customerProfile.update({
        where: { id: input.customerProfileId },
        data: {
          lastSeenAt: new Date(),
          lastMessageAt: new Date()
        }
      });
    }

    return message;
  }

  async getRecentMessages(conversationId: string, take = 6) {
    return (this.prisma as any).conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take
    });
  }

  async listConversations(workspaceId?: string, take = 20): Promise<ConversationListItem[]> {
    const rows = await (this.prisma as any).conversation.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take,
      include: {
        lead: true,
        customerProfile: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return rows.map((row: any) => ({
      id: row.id,
      customerName: row.customerProfile?.name ?? row.lead?.name ?? null,
      channel: row.channel,
      status: row.status,
      salesStage: row.salesStage,
      leadScore: row.lastLeadScore ?? null,
      temperature: row.customerProfile?.temperature ?? null,
      handoffStatus: row.handoffStatus,
      lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
      lastMessage: row.messages?.[0]?.content ?? null,
      sourcePlatform: row.customerProfile?.sourcePlatform ?? row.lead?.sourcePlatform ?? null,
      aiHandled: row.aiHandled,
      humanHandled: row.humanHandled
    }));
  }

  async getConversation(id: string) {
    return (this.prisma as any).conversation.findUnique({
      where: { id },
      include: {
        lead: true,
        customerProfile: true,
        messages: {
          orderBy: { createdAt: "asc" }
        },
        leadScores: {
          orderBy: { createdAt: "desc" }
        },
        intentPredictions: {
          orderBy: { createdAt: "desc" }
        },
        aiReplyLogs: {
          orderBy: { createdAt: "desc" }
        },
        handoffLogs: {
          orderBy: { createdAt: "desc" }
        },
        followUpJobs: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  }

  async updateConversationSnapshot(id: string, input: SnapshotUpdate) {
    const updated = await (this.prisma as any).conversation.update({
      where: { id },
      data: {
        ...(input.salesStage ? { salesStage: input.salesStage } : {}),
        ...(input.recommendedNextAction ? { recommendedNextAction: input.recommendedNextAction } : {}),
        ...(input.handoffStatus ? { handoffStatus: input.handoffStatus } : {}),
        ...(input.assistantTone !== undefined ? { assistantTone: input.assistantTone } : {}),
        ...(input.assistantStyle !== undefined ? { assistantStyle: input.assistantStyle } : {}),
        ...(input.lastIntentLabel ? { lastIntentLabel: input.lastIntentLabel } : {}),
        ...(input.lastLeadScore !== undefined ? { lastLeadScore: input.lastLeadScore } : {}),
        ...(input.aiHandled !== undefined ? { aiHandled: input.aiHandled } : {}),
        ...(input.humanHandled !== undefined ? { humanHandled: input.humanHandled } : {})
      }
    });

    if (input.leadId) {
      await (this.prisma as any).lead.update({
        where: { id: input.leadId },
        data: {
          salesStage: input.salesStage ?? undefined,
          recommendedNextAction: input.recommendedNextAction ?? undefined,
          temperature: input.temperature ?? undefined
        }
      });
    }

    if (input.customerProfileId) {
      await (this.prisma as any).customerProfile.update({
        where: { id: input.customerProfileId },
        data: {
          lifecycleStage: input.salesStage ?? undefined,
          temperature: input.temperature ?? undefined
        }
      });
    }

    return updated;
  }

  async recordIntentPrediction(input: {
    workspaceId: string;
    brandId?: string;
    leadId?: string;
    conversationId: string;
    customerProfileId?: string;
    label: string;
    confidence: number;
    query: string;
    signals?: Record<string, unknown>;
    reasoning?: string;
    messageId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return (this.prisma as any).intentPrediction.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId ?? null,
        conversationId: input.conversationId,
        customerProfileId: input.customerProfileId ?? null,
        messageId: input.messageId ?? null,
        label: input.label,
        confidence: input.confidence,
        query: input.query,
        signals: input.signals ?? null,
        reasoning: input.reasoning ?? null,
        metadata: input.metadata ?? null
      }
    });
  }

  async recordLeadScore(input: {
    workspaceId: string;
    brandId?: string;
    leadId?: string;
    conversationId?: string;
    customerProfileId?: string;
    score: number;
    temperature: CustomerTemperature;
    stage: SalesStage;
    signals?: Record<string, unknown>;
    reason: string;
  }) {
    return (this.prisma as any).leadScore.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId ?? null,
        conversationId: input.conversationId ?? null,
        customerProfileId: input.customerProfileId ?? null,
        score: input.score,
        temperature: input.temperature,
        stage: input.stage,
        signals: input.signals ?? null,
        reason: input.reason,
        isLatest: true
      }
    });
  }

  async recordAiReply(input: {
    workspaceId: string;
    brandId?: string;
    leadId?: string;
    conversationId: string;
    customerProfileId?: string;
    model: string;
    provider: string;
    promptVersion: string;
    tone?: string;
    style?: string;
    replyText: string;
    safetyStatus?: string;
    suggestedHandoff?: boolean;
    tokenUsage?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    return (this.prisma as any).aiReplyLog.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId ?? null,
        conversationId: input.conversationId,
        customerProfileId: input.customerProfileId ?? null,
        model: input.model,
        provider: input.provider,
        promptVersion: input.promptVersion,
        tone: input.tone ?? null,
        style: input.style ?? null,
        replyText: input.replyText,
        safetyStatus: input.safetyStatus ?? "SAFE",
        suggestedHandoff: input.suggestedHandoff ?? false,
        tokenUsage: input.tokenUsage ?? null,
        metadata: input.metadata ?? null
      }
    });
  }
}
