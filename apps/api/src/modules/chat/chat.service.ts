import { Injectable } from "@nestjs/common";
import { ChatOrchestratorService } from "./chat-orchestrator.service";
import { ConversationService } from "./conversation.service";
import { HandoffService } from "./handoff.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { CommentLeadService } from "./comment-lead.service";
import { FollowUpAssistantService } from "./follow-up-assistant.service";
import type { ChatMessageInput, CommentLeadInput, FollowUpRunInput, HandoffInput, KnowledgeBaseArticleInput } from "./chat.types";

@Injectable()
export class ChatService {
  constructor(
    private readonly orchestrator: ChatOrchestratorService,
    private readonly conversationService: ConversationService,
    private readonly handoffService: HandoffService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    private readonly commentLeadService: CommentLeadService,
    private readonly followUpAssistantService: FollowUpAssistantService
  ) {}

  handleMessage(input: ChatMessageInput) {
    return this.orchestrator.processMessage(input);
  }

  listConversations(workspaceId?: string, take = 20) {
    return this.conversationService.listConversations(workspaceId, take);
  }

  getConversation(id: string) {
    return this.conversationService.getConversation(id);
  }

  handoffConversation(id: string, input: HandoffInput) {
    return this.handoffService.requestHandoff(id, input);
  }

  upsertKnowledgeBase(input: KnowledgeBaseArticleInput) {
    return this.knowledgeRetrievalService.upsertArticle(input);
  }

  listKnowledgeBase(workspaceId?: string, brandId?: string) {
    return this.knowledgeRetrievalService.listKnowledgeBase(workspaceId, brandId);
  }

  commentLead(input: CommentLeadInput) {
    return this.commentLeadService.createCommentLead(input);
  }

  runFollowUp(input: FollowUpRunInput) {
    return this.followUpAssistantService.runFollowUp(input);
  }
}

