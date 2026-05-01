import { Injectable } from "@nestjs/common";
import { AiOrchestratorService } from "../../core/ai/ai-orchestrator.service";
import { DomainEventBusService } from "../../core/events/domain-event-bus.service";
import { ConversationService } from "./conversation.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { LeadScoringService } from "./lead-scoring.service";
import { SalesAssistantService } from "./sales-assistant.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { HandoffService } from "./handoff.service";
import { FollowUpAssistantService } from "./follow-up-assistant.service";
import type { ChatMessageInput, ChatReplyPayload } from "./chat.types";

@Injectable()
export class ChatOrchestratorService {
  constructor(
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly eventBus: DomainEventBusService,
    private readonly conversationService: ConversationService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly leadScoringService: LeadScoringService,
    private readonly salesAssistantService: SalesAssistantService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    private readonly handoffService: HandoffService,
    private readonly followUpAssistantService: FollowUpAssistantService
  ) {}

  async processMessage(input: ChatMessageInput): Promise<ChatReplyPayload> {
    const conversation = await this.conversationService.resolveConversation(input);
    const leadId = input.leadId ?? conversation.leadId ?? undefined;
    const customerProfile = await this.conversationService.resolveCustomerProfile({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      leadId,
      customerProfileId: input.customerProfileId,
      customerName: input.customerName,
      sourcePlatform: input.sourcePlatform,
      metadata: input.metadata
    });

    const customerMessage = await this.conversationService.appendMessage({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      conversationId: conversation.id,
      customerProfileId: customerProfile?.id,
      leadId: input.leadId,
      sender: "CUSTOMER",
      channel: input.channel,
      content: input.message,
      externalMessageId: input.externalMessageId,
      metadata: input.metadata
    });

    const history = await this.conversationService.getRecentMessages(conversation.id, 6);
    const intent = await this.intentClassifier.classify(input.message, {
      conversation,
      customerProfile,
      history
    });
    const knowledge = await this.knowledgeRetrievalService.retrieve({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      query: input.message,
      intentLabel: intent.label
    });
    const leadScore = await this.leadScoringService.score({
      conversation,
      customerProfile,
      intent,
      message: input.message,
      history
    });

    const intentPrediction = await this.conversationService.recordIntentPrediction({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      leadId,
      customerProfileId: customerProfile?.id,
      conversationId: conversation.id,
      label: intent.label,
      confidence: intent.confidence,
      query: input.message,
      signals: {
        matchedKeywords: intent.matchedKeywords,
        ...intent.signals
      },
      reasoning: intent.reasoning,
      messageId: customerMessage.id,
      metadata: {
        source: "chat-orchestrator"
      }
    });

    const leadScoreRecord = await this.conversationService.recordLeadScore({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      leadId,
      conversationId: conversation.id,
      customerProfileId: customerProfile?.id,
      score: leadScore.score,
      temperature: leadScore.temperature,
      stage: leadScore.stage,
      signals: leadScore.signals,
      reason: leadScore.reason
    });

    const assistantReply = await this.salesAssistantService.composeReply({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      conversation,
      intent,
      leadScore,
      knowledge,
      tone: input.tone,
      style: input.style
    });

    const handoffDecision = await this.handoffService.evaluate({
      conversation,
      intent,
      leadScore,
      knowledge,
      message: input.message
    });

    const replyText = handoffDecision.shouldHandoff
      ? this.handoffService.buildHandoffReply({ intent, leadScore, knowledge, note: handoffDecision.reason })
      : assistantReply.replyText;

    const aiReplyLog = await this.conversationService.recordAiReply({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      leadId,
      conversationId: conversation.id,
      customerProfileId: customerProfile?.id,
      model: assistantReply.model,
      provider: assistantReply.provider,
      promptVersion: assistantReply.promptVersion,
      tone: input.tone ?? assistantReply.tone,
      style: input.style ?? assistantReply.style,
      replyText,
      safetyStatus: handoffDecision.shouldHandoff ? "REVIEW_REQUIRED" : assistantReply.safetyStatus,
      suggestedHandoff: handoffDecision.shouldHandoff,
      tokenUsage: assistantReply.tokenUsage,
      metadata: {
        ...assistantReply.metadata,
        intent,
        leadScore,
        knowledge,
        handoffDecision
      }
    });

    const assistantMessage = await this.conversationService.appendMessage({
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      conversationId: conversation.id,
      customerProfileId: customerProfile?.id,
      leadId: input.leadId,
      sender: "AI",
      channel: input.channel,
      content: replyText,
      aiReplyLogId: aiReplyLog.id,
      metadata: {
        intent,
        leadScore,
        handoffDecision
      }
    });

    await this.conversationService.updateConversationSnapshot(conversation.id, {
      salesStage: leadScore.stage,
      recommendedNextAction: leadScore.recommendedNextAction,
      handoffStatus: handoffDecision.shouldHandoff ? "REQUESTED" : "NONE",
      assistantTone: input.tone ?? assistantReply.tone,
      assistantStyle: input.style ?? assistantReply.style,
      lastIntentLabel: intent.label,
      lastLeadScore: leadScore.score,
      aiHandled: !handoffDecision.shouldHandoff,
      humanHandled: handoffDecision.shouldHandoff ? false : conversation.humanHandled,
      leadId: input.leadId,
      customerProfileId: customerProfile?.id,
      temperature: leadScore.temperature
    });

    await this.eventBus.emit({
      name: "chat.message.processed",
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      payload: {
        conversationId: conversation.id,
        customerMessageId: customerMessage.id,
        assistantMessageId: assistantMessage.id,
        intent,
        intentPrediction,
        leadScore,
        leadScoreRecord,
        handoffDecision
      },
      occurredAt: new Date().toISOString()
    });

    if (leadScore.temperature === "HOT" || handoffDecision.shouldHandoff) {
      await this.followUpAssistantService.scheduleFromConversation({
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        conversationId: conversation.id,
        leadId,
        customerProfileId: customerProfile?.id,
        stage: leadScore.stage,
        temperature: leadScore.temperature
      });
    }

    if (handoffDecision.shouldHandoff) {
      await this.handoffService.requestHandoff(conversation.id, {
        assignedToUserId: undefined,
        reason: handoffDecision.reason,
        note: handoffDecision.reasonText,
        severity: handoffDecision.severity
      });
    }

    return {
      conversationId: conversation.id,
      customerMessageId: customerMessage.id,
      assistantMessageId: assistantMessage.id,
      replyText,
      intent,
      leadScore,
      handoffRequired: handoffDecision.shouldHandoff,
      handoffReason: handoffDecision.reason,
      nextAction: leadScore.recommendedNextAction,
      knowledge
    };
  }
}
