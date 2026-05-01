import { Injectable, NotFoundException } from "@nestjs/common";
import { ContentRequest, ContentVariant, ContentStyle } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { PrismaService } from "../prisma/prisma.service";
import { ContentGeneratorService } from "./content-generator.service";
import { CreateContentRequestDto } from "./create-content-request.dto";
import { HistoryItem, GeneratedContentResult, GeneratedVariantResult } from "./content.types";

type GeneratedContentWithRelations = Prisma.GeneratedContentGetPayload<{
  include: {
    request: true;
    variants: true;
  };
}>;

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentGenerator: ContentGeneratorService,
    private readonly tenancyService: TenancyService
  ) {}

  async generateContent(dto: CreateContentRequestDto) {
    await this.tenancyService.assertTenantAccess(dto.tenantId);
    const generation = this.contentGenerator.generate(dto);

    const persisted = await this.prisma.$transaction(async (tx) => {
      const request = await tx.contentRequest.create({
        data: {
          tenantId: dto.tenantId ?? null,
          productName: dto.productName.trim(),
          productDescription: dto.productDescription.trim(),
          targetAudience: dto.targetAudience.trim(),
          priceRange: dto.priceRange?.trim() || null,
          usageScenario: dto.usageScenario?.trim() || null,
          keywords: dto.keywords,
          requestedStyle: dto.requestedStyle
        }
      });

      const generatedContent = await tx.generatedContent.create({
        data: {
          tenantId: dto.tenantId ?? null,
          requestId: request.id,
          resolvedStyle: generation.resolvedStyle,
          summary: generation.summary,
          titleCount: generation.titles.length,
          postCount: generation.posts.length,
          scriptCount: generation.scripts.length
        }
      });

      await tx.contentVariant.createMany({
        data: generation.variants.map((variant) => ({
          generatedContentId: generatedContent.id,
          variantType: variant.variantType,
          variantIndex: variant.variantIndex,
          title: variant.title ?? null,
          previewText: variant.previewText,
          payload: variant.payload as Prisma.InputJsonValue,
          hashtags: variant.hashtags,
          platforms: variant.platforms
        }))
      });

      return tx.generatedContent.findUnique({
        where: { id: generatedContent.id },
        include: {
          request: true,
          variants: true
        }
      });
    });

    if (!persisted) {
      throw new NotFoundException("生成結果建立失敗");
    }

    return this.toHistoryItem(persisted);
  }

  async listContents(take = 20, tenantId?: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    const items = await this.prisma.generatedContent.findMany({
      where: tenantId ? { tenantId } : undefined,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        request: true,
        variants: {
          orderBy: [{ variantType: "asc" }, { variantIndex: "asc" }]
        }
      }
    });

    return items.map((item) => this.toHistoryItem(item));
  }

  private toHistoryItem(item: GeneratedContentWithRelations): HistoryItem {
    const variants = item.variants.map((variant) => ({
      id: variant.id,
      variantType: variant.variantType,
      variantIndex: variant.variantIndex,
      title: variant.title,
      previewText: variant.previewText,
      payload: variant.payload as GeneratedVariantResult["payload"],
      hashtags: variant.hashtags,
      platforms: variant.platforms,
      createdAt: variant.createdAt
    }));

    return {
      id: item.id,
      resolvedStyle: item.resolvedStyle,
      summary: item.summary,
      titleCount: item.titleCount,
      postCount: item.postCount,
      scriptCount: item.scriptCount,
      createdAt: item.createdAt,
      request: {
        id: item.request.id,
        productName: item.request.productName,
        productDescription: item.request.productDescription,
        targetAudience: item.request.targetAudience,
        priceRange: item.request.priceRange,
        usageScenario: item.request.usageScenario,
        keywords: item.request.keywords,
        requestedStyle: item.request.requestedStyle,
        createdAt: item.request.createdAt
      },
      titles: variants.filter((variant) => variant.variantType === "TITLE"),
      posts: variants.filter((variant) => variant.variantType === "POST_COPY"),
      scripts: variants.filter((variant) => variant.variantType === "SCRIPT")
    };
  }
}
