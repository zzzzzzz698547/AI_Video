import { Injectable } from "@nestjs/common";
import type { ChannelAdapterContract } from "./channel-adapter.interface";

@Injectable()
export class FacebookMessengerAdapter implements ChannelAdapterContract {
  readonly channel = "FACEBOOK_MESSENGER";

  async connectAccount() {}
  async refreshToken() {}
  validateWebhook(): boolean {
    return true;
  }
  async sendMessage() {
    return { externalMessageId: "facebook-messenger-placeholder" };
  }
}

