import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { FunnelDashboardSnapshot, LeadSourcePlatform } from "./funnel.types";

@Injectable()
export class ConversionAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(workspaceId?: string): Promise<FunnelDashboardSnapshot> {
    const [clicks, leads, deals] = await Promise.all([
      (this.prisma as any).clickEvent.count({
        where: {
          trackingLink: {
            workspaceId: workspaceId ?? undefined
          }
        }
      }),
      (this.prisma as any).lead.count({ where: { workspaceId: workspaceId ?? undefined } }),
      (this.prisma as any).deal.count({
        where: {
          workspaceId: workspaceId ?? undefined,
          status: "WON"
        }
      })
    ]);

    const leadConversionRate = clicks > 0 ? leads / clicks : 0;
    const dealConversionRate = leads > 0 ? deals / leads : 0;
    const topSources = await this.topSources(workspaceId);

    return {
      clicks,
      leads,
      wonDeals: deals,
      leadConversionRate,
      dealConversionRate,
      topSources,
      funnelStages: [
        { stage: "Clicks", count: clicks },
        { stage: "Leads", count: leads },
        { stage: "Won Deals", count: deals }
      ],
      ctaSuggestions: await this.generateCtaSuggestions(workspaceId)
    };
  }

  async contentAnalytics(workspaceId?: string) {
    const [clicks, leads, deals] = await Promise.all([
      (this.prisma as any).clickEvent.findMany({
        where: {
          trackingLink: {
            workspaceId: workspaceId ?? undefined
          }
        },
        include: { trackingLink: true },
        orderBy: { clickedAt: "desc" }
      }),
      (this.prisma as any).lead.findMany({
        where: { workspaceId: workspaceId ?? undefined },
        include: { trackingLink: true, landingPage: true, deals: true }
      }),
      (this.prisma as any).deal.findMany({
        where: { workspaceId: workspaceId ?? undefined },
        include: { lead: true, product: true }
      })
    ]);

    const clicksByPlatform = this.groupBySourcePlatform(clicks.map((item: any) => item.sourcePlatform));
    const leadsByPlatform = this.groupBySourcePlatform(leads.map((item: any) => item.sourcePlatform));
    const dealsByPlatform = this.groupBySourcePlatform(deals.map((item: any) => item.sourcePlatform));

    return {
      clicks: clicks.length,
      leads: leads.length,
      deals: deals.length,
      clicksByPlatform,
      leadsByPlatform,
      dealsByPlatform,
      conversionRateByPlatform: this.buildPlatformConversionRate(clicksByPlatform, leadsByPlatform, dealsByPlatform)
    };
  }

  async topSources(workspaceId?: string) {
    const rows = await (this.prisma as any).trackingLink.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      include: {
        _count: { select: { clicks: true, leads: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20
    });

    const deals = await (this.prisma as any).deal.groupBy({
      by: ["sourcePlatform"],
      where: { workspaceId: workspaceId ?? undefined, status: "WON" },
      _count: { sourcePlatform: true }
    });

    const dealMap = new Map<LeadSourcePlatform, number>();
    for (const item of deals) {
      dealMap.set(item.sourcePlatform, item._count.sourcePlatform);
    }

    return rows.map((row: any) => ({
      sourcePlatform: row.sourcePlatform,
      clicks: row._count.clicks,
      leads: row._count.leads,
      wonDeals: dealMap.get(row.sourcePlatform) ?? 0
    }));
  }

  async generateCtaSuggestions(workspaceId?: string) {
    const leads = await (this.prisma as any).lead.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      include: {
        trackingLink: true,
        deals: true
      }
    });

    const counts = new Map<string, { count: number; won: number }>();
    for (const lead of leads as any[]) {
      const key = lead.notes?.slice(0, 40) ?? lead.sourcePlatform;
      const value = counts.get(key) ?? { count: 0, won: 0 };
      value.count += 1;
      value.won += lead.deals.some((deal: any) => deal.status === "WON") ? 1 : 0;
      counts.set(key, value);
    }

    return [...counts.entries()]
      .map(([label, value]) => ({
        label,
        reason: `名單表現：${value.won}/${value.count}`,
        confidence: value.count === 0 ? 0 : Number((value.won / value.count).toFixed(2))
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private groupBySourcePlatform(values: LeadSourcePlatform[]) {
    return values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  }

  private buildPlatformConversionRate(
    clicks: Record<string, number>,
    leads: Record<string, number>,
    deals: Record<string, number>
  ) {
    const platforms = new Set([...Object.keys(clicks), ...Object.keys(leads), ...Object.keys(deals)]);
    return [...platforms].map((platform) => ({
      platform,
      clickToLeadRate: clicks[platform] ? (leads[platform] ?? 0) / clicks[platform] : 0,
      leadToDealRate: leads[platform] ? (deals[platform] ?? 0) / leads[platform] : 0
    }));
  }
}
