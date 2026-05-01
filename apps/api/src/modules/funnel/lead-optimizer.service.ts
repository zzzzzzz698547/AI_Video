import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConversionAnalyticsService } from "./conversion-analytics.service";

@Injectable()
export class LeadOptimizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversionAnalytics: ConversionAnalyticsService
  ) {}

  async suggestOptimizations(workspaceId?: string) {
    const [dashboard, templates, pages] = await Promise.all([
      this.conversionAnalytics.dashboard(workspaceId),
      (this.prisma as any).messageTemplate.findMany({
        where: { workspaceId: workspaceId ?? undefined, isActive: true },
        orderBy: { updatedAt: "desc" }
      }),
      (this.prisma as any).landingPage.findMany({
        where: { workspaceId: workspaceId ?? undefined },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const bestTemplate = templates[0];
    const bestPage = pages[0];

    return {
      dashboard,
      suggestions: [
        {
          title: "優先測試高轉換 CTA",
          reason: dashboard.ctaSuggestions[0]?.reason ?? "目前尚未累積足夠樣本",
          action: dashboard.ctaSuggestions[0]?.label ?? "新增 CTA 測試",
          confidence: dashboard.ctaSuggestions[0]?.confidence ?? 0.5
        },
        bestTemplate
          ? {
              title: "強化 Follow-up 模板",
              reason: `目前最佳模板：${bestTemplate.name}`,
              action: `優先使用 ${bestTemplate.channel} 模板`,
              confidence: 0.8
            }
          : {
              title: "建立 Follow-up 模板",
              reason: "尚未建立自動跟進模板",
              action: "新增歡迎/優惠/再行銷模板",
              confidence: 0.55
            },
        bestPage
          ? {
              title: "優化 Landing Page 文案",
              reason: `目前頁面版本：${bestPage.slug}:${bestPage.variantKey}`,
              action: "測試不同痛點與 CTA 組合",
              confidence: 0.75
            }
          : {
              title: "建立 Landing Page",
              reason: "尚未有可測試的轉換頁",
              action: "先建立商品頁與 A/B 版本",
              confidence: 0.6
            }
      ]
    };
  }
}
