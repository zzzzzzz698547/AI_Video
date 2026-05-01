import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { FollowUpRunInput } from "./chat.types";

@Injectable()
export class FollowUpAssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async scheduleFromConversation(input: {
    workspaceId: string;
    brandId?: string;
    conversationId: string;
    leadId?: string;
    customerProfileId?: string;
    stage: string;
    temperature: string;
  }) {
    const rules = await (this.prisma as any).followUpRule.findMany({
      where: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? undefined,
        isActive: true
      },
      orderBy: [{ delayMinutes: "asc" }]
    });

    if (rules.length === 0) {
      return [];
    }

    const now = new Date();
    const jobs = [];
    for (const rule of rules) {
      if (rule.trigger === "NO_REPLY" && input.temperature !== "HOT") {
        continue;
      }
      const job = await (this.prisma as any).followUpJob.create({
        data: {
          workspaceId: input.workspaceId,
          brandId: input.brandId ?? null,
          ruleId: rule.id,
          leadId: input.leadId ?? null,
          conversationId: input.conversationId,
          customerProfileId: input.customerProfileId ?? null,
          channel: rule.channel,
          status: "PENDING",
          runAt: new Date(now.getTime() + rule.delayMinutes * 60_000),
          payload: {
            trigger: rule.trigger,
            stage: input.stage,
            temperature: input.temperature
          }
        }
      });
      jobs.push(job);
    }

    return jobs;
  }

  async runFollowUp(input: FollowUpRunInput) {
    const jobs = await (this.prisma as any).followUpJob.findMany({
      where: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? undefined,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.customerProfileId ? { customerProfileId: input.customerProfileId } : {}),
        status: "PENDING",
        runAt: { lte: new Date() }
      },
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }]
    });

    const executed = [];
    for (const job of jobs) {
      const updated = await (this.prisma as any).followUpJob.update({
        where: { id: job.id },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          executedAt: new Date(),
          result: {
            message: "Follow-up job skeleton executed"
          }
        }
      });
      executed.push(updated);
    }

    return executed;
  }
}

