import { Injectable } from "@nestjs/common";
import type { AbTest, AbTestResult } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AnalyticsTimeRange } from "./analytics.types";

export type CreateAbTestInput = {
  workspaceId?: string;
  brandId?: string;
  contentId?: string;
  videoId?: string;
  testType: string;
  hypothesis: string;
  metricName: string;
};

export type RecordAbTestResultInput = {
  abTestId: string;
  variantKey: string;
  variantLabel?: string;
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  completionRate: number;
  raw?: unknown;
};

@Injectable()
export class AbTestService {
  constructor(private readonly prisma: PrismaService) {}

  async createTest(input: CreateAbTestInput): Promise<AbTest> {
    return this.prisma.abTest.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        brandId: input.brandId ?? null,
        contentId: input.contentId ?? null,
        videoId: input.videoId ?? null,
        testType: input.testType,
        hypothesis: input.hypothesis,
        metricName: input.metricName
      }
    });
  }

  async listTests(range: AnalyticsTimeRange = {}): Promise<AbTest[]> {
    return this.prisma.abTest.findMany({
      where: this.rangeWhere(range),
      orderBy: { updatedAt: "desc" }
    });
  }

  async recordResult(input: RecordAbTestResultInput): Promise<AbTestResult> {
    const score = this.calculateScore(input);
    const result = await this.prisma.abTestResult.create({
      data: {
        abTestId: input.abTestId,
        variantKey: input.variantKey,
        variantLabel: input.variantLabel ?? null,
        impressions: input.impressions,
        views: input.views,
        clicks: input.clicks,
        likes: input.likes,
        comments: input.comments,
        shares: input.shares,
        saves: input.saves,
        completionRate: input.completionRate,
        score,
        raw: input.raw as never
      }
    });

    await this.resolveWinner(input.abTestId);
    return result;
  }

  async resolveWinner(abTestId: string) {
    const results = await this.prisma.abTestResult.findMany({
      where: { abTestId },
      orderBy: { score: "desc" }
    });

    if (results.length === 0) {
      return null;
    }

    const winner = results[0];
    await this.prisma.abTestResult.updateMany({
      where: { abTestId },
      data: { isWinner: false }
    });
    await this.prisma.abTestResult.update({
      where: { id: winner.id },
      data: { isWinner: true }
    });
    return this.prisma.abTest.update({
      where: { id: abTestId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        winnerVariantKey: winner.variantKey
      }
    });
  }

  private rangeWhere(range: AnalyticsTimeRange) {
    return {
      workspaceId: range.workspaceId ?? undefined,
      brandId: range.brandId ?? undefined
    };
  }

  private calculateScore(input: RecordAbTestResultInput) {
    const ctr = input.impressions > 0 ? input.clicks / input.impressions : 0;
    const engagement = input.views > 0 ? (input.likes + input.comments + input.shares + input.saves) / input.views : 0;
    const completion = input.completionRate / 100;
    return Number((ctr * 0.5 + engagement * 0.3 + completion * 0.2).toFixed(4));
  }
}
