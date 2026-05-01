import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { FollowUpChannel, LeadFollowUpTemplateInput } from "./funnel.types";

@Injectable()
export class FollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(workspaceId?: string): Promise<any[]> {
    return (this.prisma as any).messageTemplate.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      orderBy: [{ channel: "asc" }, { updatedAt: "desc" }]
    });
  }

  async upsertTemplate(input: LeadFollowUpTemplateInput): Promise<any> {
    return (this.prisma as any).messageTemplate.upsert({
      where: {
        workspaceId_templateKey: {
          workspaceId: input.workspaceId,
          templateKey: input.templateKey
        }
      },
      create: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        templateKey: input.templateKey,
        channel: input.channel,
        name: input.name,
        subject: input.subject ?? null,
        body: input.body,
        triggerEvent: input.triggerEvent,
        delayMinutes: input.delayMinutes ?? 0,
        metadata: input.metadata ?? null
      },
      update: {
        brandId: input.brandId ?? null,
        channel: input.channel,
        name: input.name,
        subject: input.subject ?? null,
        body: input.body,
        triggerEvent: input.triggerEvent,
        delayMinutes: input.delayMinutes ?? 0,
        metadata: input.metadata ?? null
      }
    });
  }

  async triggerLeadFollowUp(leadId: string) {
    const lead = await (this.prisma as any).lead.findUnique({
      where: { id: leadId },
      include: { workspace: true, brand: true, product: true }
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const templates = await (this.prisma as any).messageTemplate.findMany({
      where: {
        workspaceId: lead.workspaceId,
        isActive: true
      },
      orderBy: [{ channel: "asc" }, { delayMinutes: "asc" }]
    });

    return (this.prisma as any).$transaction(
      templates.map((template: any) =>
        (this.prisma as any).followUpLog.create({
          data: {
            workspaceId: lead.workspaceId,
            brandId: lead.brandId ?? null,
            leadId: lead.id,
            messageTemplateId: template.id,
            channel: template.channel,
            status: "QUEUED",
            message: this.renderTemplate(template.body, lead),
            metadata: {
              templateKey: template.templateKey,
              triggerEvent: template.triggerEvent,
              delayMinutes: template.delayMinutes
            }
          }
        })
      )
    );
  }

  async recordFollowUpLog(input: {
    workspaceId: string;
    brandId?: string;
    leadId: string;
    messageTemplateId?: string;
    channel: FollowUpChannel;
    status: string;
    message: string;
    externalMessageId?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    return (this.prisma as any).followUpLog.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId ?? null,
        leadId: input.leadId,
        messageTemplateId: input.messageTemplateId ?? null,
        channel: input.channel,
        status: input.status,
        message: input.message,
        externalMessageId: input.externalMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ?? null
      }
    });
  }

  private renderTemplate(body: string, lead: { name: string; product?: { name: string | null } | null }) {
    return body
      .replaceAll("{{name}}", lead.name)
      .replaceAll("{{productName}}", lead.product?.name ?? "");
  }
}
