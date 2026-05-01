import { Injectable } from "@nestjs/common";
import type { ChannelAdapterContract } from "./channel-adapter.interface";

@Injectable()
export class LineOfficialAdapter implements ChannelAdapterContract {
  readonly channel = "LINE_OFFICIAL_ACCOUNT";

  async connectAccount() {}
  async refreshToken() {}
  validateWebhook(): boolean {
    return true;
  }
  async sendMessage() {
    return { externalMessageId: "line-official-placeholder" };
  }
}

