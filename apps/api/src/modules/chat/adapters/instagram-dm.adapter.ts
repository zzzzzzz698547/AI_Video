import { Injectable } from "@nestjs/common";
import type { ChannelAdapterContract } from "./channel-adapter.interface";

@Injectable()
export class InstagramDmAdapter implements ChannelAdapterContract {
  readonly channel = "INSTAGRAM_DM";

  async connectAccount() {}
  async refreshToken() {}
  validateWebhook(): boolean {
    return true;
  }
  async sendMessage() {
    return { externalMessageId: "instagram-dm-placeholder" };
  }
}

