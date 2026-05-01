import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatOrchestratorService } from "./chat-orchestrator.service";
import { ConversationService } from "./conversation.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { LeadScoringService } from "./lead-scoring.service";
import { SalesAssistantService } from "./sales-assistant.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { HandoffService } from "./handoff.service";
import { FollowUpAssistantService } from "./follow-up-assistant.service";
import { CommentLeadService } from "./comment-lead.service";
import { FacebookMessengerAdapter } from "./adapters/facebook-messenger.adapter";
import { InstagramDmAdapter } from "./adapters/instagram-dm.adapter";
import { LineOfficialAdapter } from "./adapters/line-official.adapter";
import { WebsiteChatAdapter } from "./adapters/website-chat.adapter";
import { CommentToLeadAdapter } from "./adapters/comment-to-lead.adapter";

@Module({
  imports: [CoreModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatOrchestratorService,
    ConversationService,
    IntentClassifierService,
    LeadScoringService,
    SalesAssistantService,
    KnowledgeRetrievalService,
    HandoffService,
    FollowUpAssistantService,
    CommentLeadService,
    FacebookMessengerAdapter,
    InstagramDmAdapter,
    LineOfficialAdapter,
    WebsiteChatAdapter,
    CommentToLeadAdapter
  ],
  exports: [ChatService, ChatOrchestratorService, ConversationService, KnowledgeRetrievalService, HandoffService]
})
export class ChatModule {}

