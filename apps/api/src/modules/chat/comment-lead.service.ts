import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CommentLeadInput } from "./chat.types";

@Injectable()
export class CommentLeadService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommentLead(input: CommentLeadInput) {
    const autoReplyText = this.buildAutoReply(input.commentText);
    const lead = await this.ensureLead(input);

    const record = await (this.prisma as any).commentLead.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        contentId: input.contentId ?? null,
        videoId: input.videoId ?? null,
        postId: input.postId,
        commentId: input.commentId,
        sourcePlatform: this.normalizePlatform(input.commentText),
        commenterName: input.commenterName ?? null,
        commentText: input.commentText,
        leadId: lead?.id ?? null,
        autoReplyText,
        status: autoReplyText ? "REPLIED" : "NEW",
        metadata: input.metadata ?? null
      }
    });

    return {
      commentLead: record,
      lead,
      autoReplyText,
      nextAction: lead ? "INVITE_TO_LINE" : "ASK_CLARIFYING_QUESTION"
    };
  }

  private async ensureLead(input: CommentLeadInput) {
    const isHighIntent = this.isHighIntent(input.commentText);
    if (!isHighIntent) {
      return null;
    }

    return (this.prisma as any).lead.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        name: input.commenterName ?? "留言客戶",
        source: "comment-to-lead",
        sourcePlatform: this.normalizePlatform(input.commentText),
        notes: input.commentText,
        tags: ["comment-to-lead"],
        metadata: input.metadata ?? null
      }
    });
  }

  private isHighIntent(text: string) {
    const normalized = text.toLowerCase();
    return ["價格", "多少", "怎麼買", "私訊", "line", "下單", "報價", "訂購"].some((keyword) => normalized.includes(keyword.toLowerCase()));
  }

  private buildAutoReply(text: string) {
    if (this.isHighIntent(text)) {
      return "我先幫你把資訊整理好，想要我直接私訊你嗎？";
    }
    if (text.includes("?")) {
      return "可以的，我幫你確認一下，再回你最準的資訊。";
    }
    return "收到，我先幫你留意這則留言。";
  }

  private normalizePlatform(text: string) {
    if (text.includes("Threads")) {
      return "THREADS";
    }
    if (text.includes("YouTube")) {
      return "YOUTUBE";
    }
    return "IG";
  }
}

