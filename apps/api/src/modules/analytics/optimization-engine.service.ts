import { Injectable } from "@nestjs/common";
import { Prisma, OptimizationTargetModule, OptimizationRuleType, type OptimizationRule, type ContentPerformance } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AnalyticsTimeRange } from "./analytics.types";
import type { DomainModuleName, OptimizationContext, OptimizationRuleSnapshot } from "@ai-vidio/types";
import { AnalyticsEngineService } from "./analytics-engine.service";

@Injectable()
export class OptimizationEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsEngine: AnalyticsEngineService
  ) {}

  async buildOptimizationContext(range: AnalyticsTimeRange = {}): Promise<OptimizationContext> {
    const dashboard = await this.analyticsEngine.buildDashboard(range);
    return dashboard.optimizationContext;
  }

  async deriveRules(range: AnalyticsTimeRange = {}): Promise<OptimizationRuleSnapshot[]> {
    const [contentPerformance, existingRules] = await Promise.all([
      this.prisma.contentPerformance.findMany({
        where: this.rangeWhere(range),
        orderBy: { score: "desc" },
        take: 10
      }),
      this.prisma.optimizationRule.findMany({
        where: {
          ...this.rangeWhere(range),
          active: true
        }
      })
    ]);

    const candidates = this.buildCandidates(contentPerformance);
    const savedRules = await this.saveRules(range, candidates, existingRules);
    await this.writeOptimizationLogs(range, savedRules);
    return savedRules.map((rule) => this.toRuleSnapshot(rule));
  }

  async refreshOptimizationRules(range: AnalyticsTimeRange = {}) {
    const rules = await this.deriveRules(range);
    return {
      rules,
      optimizationContext: await this.buildOptimizationContext(range)
    };
  }

  private rangeWhere(range: AnalyticsTimeRange) {
    return {
      workspaceId: range.workspaceId ?? undefined,
      brandId: range.brandId ?? undefined
    };
  }

  private buildCandidates(contentPerformance: ContentPerformance[]) {
    const topContent = contentPerformance[0];
    const bestHook = topContent?.bestHook ?? "用疑問句開場";
    const bestCta = topContent?.bestCta ?? "現在就點擊了解";
    const bestLength = topContent?.bestLengthSeconds ?? 15;
    const bestHour = topContent?.bestPublishHour ?? 21;

    return [
      {
        ruleKey: "best-hook-pattern",
        targetModule: OptimizationTargetModule.CONTENT,
        ruleType: OptimizationRuleType.HOOK,
        description: `開頭優先使用：${bestHook}`,
        score: topContent?.score ?? 0,
        confidence: 0.88,
        payload: { bestHook }
      },
      {
        ruleKey: "best-cta-pattern",
        targetModule: OptimizationTargetModule.CONTENT,
        ruleType: OptimizationRuleType.CTA,
        description: `CTA 優先使用：${bestCta}`,
        score: topContent?.score ?? 0,
        confidence: 0.84,
        payload: { bestCta }
      },
      {
        ruleKey: "best-length-seconds",
        targetModule: OptimizationTargetModule.VIDEO,
        ruleType: OptimizationRuleType.LENGTH,
        description: `影片長度優先維持在 ${bestLength} 秒`,
        score: topContent?.score ?? 0,
        confidence: 0.8,
        payload: { bestLength }
      },
      {
        ruleKey: "best-publish-hour",
        targetModule: OptimizationTargetModule.CONTENT,
        ruleType: OptimizationRuleType.SCHEDULE,
        description: `建議發文時間：${bestHour.toString().padStart(2, "0")}:00`,
        score: topContent?.score ?? 0,
        confidence: 0.78,
        payload: { bestHour }
      }
    ];
  }

  private async saveRules(
    range: AnalyticsTimeRange,
    candidates: Array<{
      ruleKey: string;
      targetModule: OptimizationTargetModule;
      ruleType: OptimizationRuleType;
      description: string;
      score: number;
      confidence: number;
      payload: Record<string, unknown>;
    }>,
    existingRules: OptimizationRule[]
  ) {
    const savedRules: OptimizationRule[] = [];

    for (const candidate of candidates) {
      const current = existingRules.find((rule) => rule.ruleKey === candidate.ruleKey);
      const data = {
        workspaceId: range.workspaceId ?? null,
        brandId: range.brandId ?? null,
        ruleKey: candidate.ruleKey,
        targetModule: candidate.targetModule,
        ruleType: candidate.ruleType,
        description: candidate.description,
        score: candidate.score,
        confidence: candidate.confidence,
        active: true,
        payload: candidate.payload as Prisma.InputJsonValue
      };

      if (current) {
        savedRules.push(
          await this.prisma.optimizationRule.update({
            where: { id: current.id },
            data
          })
        );
      } else {
        savedRules.push(await this.prisma.optimizationRule.create({ data }));
      }
    }

    return savedRules;
  }

  private async writeOptimizationLogs(range: AnalyticsTimeRange, rules: OptimizationRule[]) {
    if (rules.length === 0) {
      return;
    }

    await this.prisma.optimizationLog.createMany({
      data: rules.map((rule) => ({
        workspaceId: range.workspaceId ?? null,
        brandId: range.brandId ?? null,
        ruleId: rule.id,
        sourceModule: "analytics",
        action: "rule_derived",
        decision: {
          ruleKey: rule.ruleKey,
          targetModule: rule.targetModule,
          ruleType: rule.ruleType,
          score: rule.score
        } as Prisma.InputJsonValue
      }))
    });
  }

  private toRuleSnapshot(rule: OptimizationRule): OptimizationRuleSnapshot {
    return {
      id: rule.id,
      ruleKey: rule.ruleKey,
      targetModule: this.normalizeTargetModule(rule.targetModule),
      ruleType: rule.ruleType,
      description: rule.description,
      score: rule.score,
      active: rule.active
    };
  }

  private normalizeTargetModule(value: OptimizationRule["targetModule"]): DomainModuleName {
    switch (value) {
      case "CONTENT":
        return "content";
      case "VIDEO":
        return "video";
      case "CRM":
        return "crm";
      default:
        return "content";
    }
  }
}
