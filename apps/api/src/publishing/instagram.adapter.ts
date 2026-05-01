import { Injectable } from "@nestjs/common";
import { PublishingPlatform } from "@prisma/client";
import { BasePlatformAdapter } from "./base-platform.adapter";

@Injectable()
export class InstagramAdapter extends BasePlatformAdapter {
  readonly platform = PublishingPlatform.INSTAGRAM;
}
