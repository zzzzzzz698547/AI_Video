import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { DealStatusUpdateInput } from "../funnel/funnel.types";

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listDeals(workspaceId?: string, take = 50): Promise<any[]> {
    return (this.prisma as any).deal.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      orderBy: [{ stageOrder: "asc" }, { updatedAt: "desc" }],
      take,
      include: { lead: true, product: true }
    });
  }

  async getDeal(id: string) {
    return (this.prisma as any).deal.findUnique({
      where: { id },
      include: { lead: true, product: true, workspace: true, brand: true }
    });
  }

  async updateDealStatus(id: string, input: DealStatusUpdateInput) {
    return (this.prisma as any).deal.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes,
        stageOrder: input.stageOrder ?? undefined,
        amount: input.amount ?? undefined,
        currency: input.currency ?? undefined,
        closedAt: input.status === "WON" || input.status === "LOST" ? new Date() : undefined
      }
    });
  }

  async upsertDealFromLead(input: {
    workspaceId: string;
    brandId?: string;
    leadId: string;
    productId?: string;
    title: string;
    amount?: number;
    currency?: string;
    sourcePlatform?: string;
    notes?: string;
    stageOrder?: number;
  }) {
    return (this.prisma as any).deal.upsert({
      where: {
        leadId: input.leadId
      },
      create: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId,
        productId: input.productId ?? null,
        title: input.title,
        amount: input.amount ?? null,
        currency: input.currency ?? "TWD",
        sourcePlatform: input.sourcePlatform ?? "UNKNOWN",
        notes: input.notes ?? null,
        stageOrder: input.stageOrder ?? 0
      },
      update: {
        brandId: input.brandId ?? null,
        productId: input.productId ?? null,
        title: input.title,
        amount: input.amount ?? undefined,
        currency: input.currency ?? undefined,
        notes: input.notes ?? undefined,
        stageOrder: input.stageOrder ?? undefined
      }
    });
  }
}
