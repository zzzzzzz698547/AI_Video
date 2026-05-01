import { Injectable } from "@nestjs/common";
import type { ChannelAdapterContract } from "./channel-adapter.interface";

@Injectable()
export class WebsiteChatAdapter implements ChannelAdapterContract {
  readonly channel = "WEBSITE_CHAT";

  async connectAccount() {}
  async refreshToken() {}
  validateWebhook(): boolean {
    return true;
  }
  async sendMessage() {
    return { externalMessageId: "web-chat-placeholder" };
  }
}

