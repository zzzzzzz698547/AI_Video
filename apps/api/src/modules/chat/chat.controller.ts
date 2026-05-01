import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ok } from "../../core/http/api-response";
import { ChatService } from "./chat.service";
import type {
  ChatMessageInput,
  CommentLeadInput,
  FollowUpRunInput,
  HandoffInput,
  KnowledgeBaseArticleInput
} from "./chat.types";

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("chat/message")
  async message(@Body() body: ChatMessageInput) {
    return ok(await this.chatService.handleMessage(body));
  }

  @Get("chat/conversations")
  async conversations(@Query("workspaceId") workspaceId?: string, @Query("take") take?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return ok(await this.chatService.listConversations(workspaceId, limit));
  }

  @Get("chat/conversation/:id")
  async conversation(@Param("id") id: string) {
    return ok(await this.chatService.getConversation(id));
  }

  @Post("chat/handoff/:id")
  async handoff(@Param("id") id: string, @Body() body: HandoffInput) {
    return ok(await this.chatService.handoffConversation(id, body));
  }

  @Post("knowledge-base")
  async upsertKnowledgeBase(@Body() body: KnowledgeBaseArticleInput) {
    return ok(await this.chatService.upsertKnowledgeBase(body));
  }

  @Get("knowledge-base")
  async knowledgeBase(@Query("workspaceId") workspaceId?: string, @Query("brandId") brandId?: string) {
    return ok(await this.chatService.listKnowledgeBase(workspaceId, brandId));
  }

  @Post("comment-lead")
  async commentLead(@Body() body: CommentLeadInput) {
    return ok(await this.chatService.commentLead(body));
  }

  @Post("follow-up/run")
  async runFollowUp(@Body() body: FollowUpRunInput) {
    return ok(await this.chatService.runFollowUp(body));
  }
}

