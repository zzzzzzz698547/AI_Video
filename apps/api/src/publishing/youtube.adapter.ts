import { Injectable } from "@nestjs/common";
import { PublishingPlatform } from "@prisma/client";
import { BasePlatformAdapter } from "./base-platform.adapter";

@Injectable()
export class YouTubeAdapter extends BasePlatformAdapter {
  readonly platform = PublishingPlatform.YOUTUBE;
}
