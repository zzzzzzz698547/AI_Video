import { Injectable } from "@nestjs/common";
import type { ChannelAdapterContract } from "./channel-adapter.interface";

@Injectable()
export class CommentToLeadAdapter implements ChannelAdapterContract {
  readonly channel = "COMMENT_TO_LEAD";

  async connectAccount() {}
  async refreshToken() {}
  validateWebhook(): boolean {
    return true;
  }
  async sendMessage() {
    return { externalMessageId: "comment-to-lead-placeholder" };
  }
}

