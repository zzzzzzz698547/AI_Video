import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { LeadFormInput, LeadStatusUpdateInput } from "./funnel.types";

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  async submitLead(input: LeadFormInput): Promise<any> {
    const deduped = await this.findExistingLead(input);
    if (deduped) {
      return (this.prisma as any).lead.update({
        where: { id: deduped.id },
        data: {
          name: input.name,
          email: input.email ?? deduped.email,
          phone: input.phone ?? deduped.phone,
          lineId: input.lineId ?? deduped.lineId,
          notes: input.notes ?? deduped.notes,
          tags: input.tags ?? deduped.tags,
          sourcePlatform: input.sourcePlatform,
          trackingLinkId: input.trackingLinkId ?? deduped.trackingLinkId,
          landingPageId: input.landingPageId ?? deduped.landingPageId,
          metadata: input.metadata ?? null
        }
      });
    }

    return (this.prisma as any).lead.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        productId: input.productId ?? null,
        landingPageId: input.landingPageId ?? null,
        trackingLinkId: input.trackingLinkId ?? null,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        lineId: input.lineId ?? null,
        sourcePlatform: input.sourcePlatform,
        source: input.sourcePlatform,
        tags: input.tags ?? [],
        notes: input.notes ?? null,
        metadata: input.metadata ?? null
      }
    });
  }

  async listLeads(workspaceId?: string, take = 50) {
    return (this.prisma as any).lead.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        trackingLink: true,
        landingPage: true,
        deals: true
      }
    });
  }

  async updateLeadStatus(id: string, input: LeadStatusUpdateInput) {
    return (this.prisma as any).lead.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes,
        tags: input.tags ?? undefined,
        lastContactedAt: input.status === "CONTACTED" ? new Date() : undefined
      }
    });
  }

  async findLead(id: string) {
    return (this.prisma as any).lead.findUnique({
      where: { id },
      include: {
        trackingLink: true,
        landingPage: true,
        deals: true,
        followUpLogs: true,
        conversations: true
      }
    });
  }

  private async findExistingLead(input: LeadFormInput) {
    const identifiers = [
      input.email ? { email: input.email } : null,
      input.phone ? { phone: input.phone } : null,
      input.lineId ? { lineId: input.lineId } : null
    ].filter(Boolean) as Prisma.LeadWhereInput[];

    if (identifiers.length === 0) {
      return null;
    }

    const where: Prisma.LeadWhereInput = {
      workspaceId: input.workspaceId,
      OR: identifiers
    };

    return (this.prisma as any).lead.findFirst({ where });
  }
}
