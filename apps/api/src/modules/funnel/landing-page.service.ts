import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { LandingPagePayload } from "./funnel.types";

@Injectable()
export class LandingPageService {
  constructor(private readonly prisma: PrismaService) {}

  async getLandingPage(slug: string, variantKey = "default"): Promise<LandingPagePayload | null> {
    const page = await (this.prisma as any).landingPage.findFirst({
      where: { slug, variantKey },
      orderBy: { updatedAt: "desc" }
    });

    return page ? this.toPayload(page) : null;
  }

  async listLandingPages(workspaceId?: string) {
    return (this.prisma as any).landingPage.findMany({
      where: { workspaceId: workspaceId ?? undefined },
      orderBy: { updatedAt: "desc" }
    });
  }

  async upsertLandingPage(data: {
    workspaceId: string;
    brandId?: string;
    productId?: string;
    slug: string;
    variantKey?: string;
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    painPoints?: string[];
    benefits?: string[];
    ctaLabel: string;
    formFields?: string[];
    sections?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const variantKey = data.variantKey ?? "default";
    return (this.prisma as any).landingPage.upsert({
      where: {
        workspaceId_slug_variantKey: {
          workspaceId: data.workspaceId,
          slug: data.slug,
          variantKey
        }
      },
      create: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        productId: data.productId ?? null,
        slug: data.slug,
        variantKey,
        title: data.title,
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        painPoints: data.painPoints ?? [],
        benefits: data.benefits ?? [],
        ctaLabel: data.ctaLabel,
        formFields: data.formFields ?? ["name", "phone", "lineId"],
        sections: data.sections ?? null,
        metadata: data.metadata ?? null
      },
      update: {
        brandId: data.brandId ?? null,
        productId: data.productId ?? null,
        title: data.title,
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        painPoints: data.painPoints ?? [],
        benefits: data.benefits ?? [],
        ctaLabel: data.ctaLabel,
        formFields: data.formFields ?? ["name", "phone", "lineId"],
        sections: data.sections ?? null,
        metadata: data.metadata ?? null
      }
    });
  }

  private toPayload(page: any): LandingPagePayload {
    return {
      id: page.id,
      slug: page.slug,
      variantKey: page.variantKey,
      status: page.status,
      title: page.title,
      heroTitle: page.heroTitle,
      heroSubtitle: page.heroSubtitle,
      painPoints: page.painPoints,
      benefits: page.benefits,
      ctaLabel: page.ctaLabel,
      formFields: page.formFields,
      sections: page.sections,
      metadata: page.metadata
    };
  }
}
