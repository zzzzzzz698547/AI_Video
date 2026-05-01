import { Injectable } from "@nestjs/common";
import { createSlug } from "@ai-vidio/utils";
import { PrismaService } from "../../prisma/prisma.service";
import type { ClickTrackingInput, LeadSourcePlatform, TrackingLinkInput } from "./funnel.types";

@Injectable()
export class TrackingLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrackingLink(input: TrackingLinkInput): Promise<any> {
    const baseCode = input.code ?? this.generateCode(input.destinationUrl);
    const code = await this.ensureUniqueCode(baseCode);
    const shortPath = input.shortPath ?? `/go/${code}`;

    return (this.prisma as any).trackingLink.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        productId: input.productId ?? null,
        contentId: input.contentId ?? null,
        videoId: input.videoId ?? null,
        landingPageId: input.landingPageId ?? null,
        code,
        shortPath,
        destinationUrl: input.destinationUrl,
        sourcePlatform: input.sourcePlatform,
        campaignName: input.campaignName ?? null,
        metadata: input.metadata
      }
    });
  }

  async resolveTrackingLink(code: string) {
    return (this.prisma as any).trackingLink.findUnique({
      where: { code },
      include: {
        workspace: true,
        brand: true,
        product: true,
        landingPage: true,
        content: true,
        video: true
      }
    });
  }

  async recordClick(code: string, input: ClickTrackingInput): Promise<any> {
    const link = await (this.prisma as any).trackingLink.findUnique({ where: { code } });
    if (!link) {
      throw new Error("Tracking link not found");
    }

    return (this.prisma as any).clickEvent.create({
      data: {
        trackingLinkId: link.id,
        sourcePlatform: input.sourcePlatform,
        device: input.device ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        referrer: input.referrer ?? null,
        country: input.country ?? null,
        metadata: input.metadata
      }
    });
  }

  private generateCode(seed: string) {
    const slug = createSlug(seed).replace(/^-+|-+$/g, "");
    const base = slug.slice(0, 16) || "link";
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`.slice(0, 24);
  }

  private async ensureUniqueCode(baseCode: string) {
    const existing = await (this.prisma as any).trackingLink.findUnique({ where: { code: baseCode } });
    if (!existing) {
      return baseCode;
    }

    return `${baseCode}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 24);
  }
}
