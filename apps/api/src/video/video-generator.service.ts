import { Injectable, NotFoundException } from "@nestjs/common";
import { ContentStyle, ContentVariantType, MediaAssetType, MediaSourceType, VideoMediaMode, VideoSegmentType, VideoStatus, VideoStyle } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ContentGeneratorService } from "../content/content-generator.service";
import { GenerateContentInput } from "../content/content.types";
import { TenancyService } from "../core/tenancy/tenancy.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVideoProjectDto } from "./video.dto";
import { ScriptSegment, VideoGenerationResult, VideoProjectDetail } from "./video.types";
import { clipText } from "./video.utils";
import { VideoRenderService } from "./video-render.service";
import { SystemSpeechTtsService } from "./system-speech-tts.service";
import { VideoMediaService, SceneMediaAsset } from "./video-media.service";
import { dedupe, splitKeywords } from "../content/content.utils";

type VideoAnalysisSource = {
  id: string;
  workspaceId: string | null;
  brandId: string | null;
  sourceUrl: string;
  sourceHost: string;
  sourceTitle: string | null;
  sourceDescription: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  targetAudience: string | null;
  desiredTone: string | null;
  desiredLengthSeconds: number;
  focusKeywords: string[];
  result: {
    topic: string;
    summary: string;
    keyTakeaways: string[];
    recommendedHook: string;
    recommendedCTA: string;
    recommendedPlatforms: string[];
  } | null;
};

@Injectable()
export class VideoGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentGenerator: ContentGeneratorService,
    private readonly tenancyService: TenancyService,
    private readonly renderer: VideoRenderService,
    private readonly tts: SystemSpeechTtsService,
    private readonly mediaService: VideoMediaService
  ) {}

  async generateVideo(dto: CreateVideoProjectDto): Promise<VideoGenerationResult> {
    const content = dto.analysisId
      ? await this.buildContentFromAnalysis(dto.analysisId)
      : await this.loadContentById(dto.contentId);
    const tenantId = dto.tenantId ?? content.tenantId ?? content.request.tenantId ?? null;

    await this.tenancyService.assertTenantAccess(tenantId);

    const scriptVariant = this.pickScriptVariant(content.variants, dto.scriptVariantId);
    if (!scriptVariant) {
      throw new NotFoundException("找不到可用的腳本版本");
    }

    const style = this.resolveVideoStyle(dto.requestedStyle ?? content.resolvedStyle);
    const mediaMode = dto.mediaMode ?? VideoMediaMode.HYBRID;
    const title = `${content.request.productName} - ${content.request.targetAudience}`;
    const parsedSegments = this.parseScript(scriptVariant.payload as Record<string, unknown>, dto.targetDurationSeconds);

    const project = await this.prisma.videoProject.create({
      data: {
        tenantId,
        contentId: content.id,
        title,
        scriptSnapshot: scriptVariant.payload as Prisma.InputJsonValue,
        resolvedStyle: style,
        mediaMode,
        targetDurationSeconds: dto.targetDurationSeconds,
        aspectRatio: "9:16",
        resolution: "1080x1920",
        status: VideoStatus.PROCESSING
      }
    });

    const preparedAssets = await this.mediaService.buildSceneAssets({
      projectId: project.id,
      title,
      style,
      mediaMode,
      imageProvider: dto.imageProvider,
      keywords: content.request.keywords,
      segments: parsedSegments
    });

    await this.persistSegmentsAndAssets(project.id, parsedSegments, content.request.keywords, style, preparedAssets);

    const rendered = await this.renderer.renderProject({
      projectId: project.id,
      title,
      style,
      segments: parsedSegments,
      durationSeconds: dto.targetDurationSeconds,
      sceneAssets: preparedAssets
    });

    const output = await this.prisma.videoOutput.create({
      data: {
        tenantId,
        videoProjectId: project.id,
        filePath: rendered.videoPath,
        publicUrl: `/video/${project.id}/file`,
        fileSizeBytes: BigInt(0),
        width: 1080,
        height: 1920,
        durationSeconds: dto.targetDurationSeconds,
        outputFormat: "mp4",
        status: VideoStatus.READY
      }
    });

    await this.prisma.videoProject.update({
      where: { id: project.id },
      data: { status: VideoStatus.READY }
    });

    return {
      projectId: project.id,
      projectStatus: VideoStatus.READY,
      outputId: output.id,
      filePath: output.filePath,
      publicUrl: output.publicUrl,
      durationSeconds: output.durationSeconds,
      segments: parsedSegments
    };
  }

  private async loadContentById(contentId?: string) {
    if (!contentId) {
      throw new NotFoundException("請先選擇內容或網址分析結果");
    }

    const content = await this.prisma.generatedContent.findUnique({
      where: { id: contentId },
      include: {
        request: true,
        variants: true
      }
    });

    if (!content) {
      throw new NotFoundException("找不到對應的內容");
    }

    return content;
  }

  private async buildContentFromAnalysis(analysisId: string) {
    const analysis = await this.prisma.videoUrlAnalysisRequest.findUnique({
      where: { id: analysisId },
      include: {
        result: {
          include: {
            variants: {
              orderBy: [{ variantType: "asc" }, { variantIndex: "asc" }]
            }
          }
        }
      }
    });

    if (!analysis || !analysis.result) {
      throw new NotFoundException("找不到對應的網址分析結果");
    }

    const analysisResult = analysis.result!;
    const analysisSource: VideoAnalysisSource = {
      id: analysis.id,
      workspaceId: analysis.workspaceId,
      brandId: analysis.brandId,
      sourceUrl: analysis.sourceUrl,
      sourceHost: analysis.sourceHost,
      sourceTitle: analysis.sourceTitle,
      sourceDescription: analysis.sourceDescription,
      analysisGoal: analysis.analysisGoal,
      analysisMode: analysis.analysisMode,
      targetAudience: analysis.targetAudience,
      desiredTone: analysis.desiredTone,
      desiredLengthSeconds: analysis.desiredLengthSeconds,
      focusKeywords: analysis.focusKeywords,
      result: {
        topic: analysisResult.topic,
        summary: analysisResult.summary,
        keyTakeaways: analysisResult.keyTakeaways,
        recommendedHook: analysisResult.recommendedHook,
        recommendedCTA: analysisResult.recommendedCTA,
        recommendedPlatforms: analysisResult.recommendedPlatforms
      }
    };
    const input = this.buildGeneratedContentInputFromAnalysis(analysisSource);
    const generated = this.contentGenerator.generate(input);

    const persisted = await this.prisma.$transaction(async (tx) => {
      const request = await tx.contentRequest.create({
        data: {
          tenantId: analysis.tenantId ?? null,
          productName: input.productName,
          productDescription: input.productDescription,
          targetAudience: input.targetAudience,
          priceRange: input.priceRange ?? null,
          usageScenario: input.usageScenario ?? null,
          keywords: input.keywords,
          requestedStyle: input.requestedStyle
        }
      });

      const generatedContent = await tx.generatedContent.create({
        data: {
          tenantId: analysis.tenantId ?? null,
          requestId: request.id,
          resolvedStyle: generated.resolvedStyle,
          summary: generated.summary,
          titleCount: generated.titles.length,
          postCount: generated.posts.length,
          scriptCount: generated.scripts.length
        }
      });

      await tx.contentVariant.createMany({
        data: generated.variants.map((variant) => ({
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
      throw new NotFoundException("網址分析內容轉換失敗");
    }

    return persisted;
  }

  private buildGeneratedContentInputFromAnalysis(analysis: VideoAnalysisSource): GenerateContentInput {
    const analysisResult = analysis.result!;
    const sourceTitle = analysis.sourceTitle?.trim() || analysisResult.topic || analysis.sourceHost;
    const summary = analysisResult.summary.trim();
    const takeaways = analysisResult.keyTakeaways.slice(0, 4).join(" ");
    const keywords = dedupe(
      splitKeywords([
        sourceTitle,
        analysisResult.topic,
        analysis.analysisGoal,
        analysis.targetAudience ?? "",
        ...analysis.focusKeywords,
        ...analysisResult.recommendedPlatforms
      ])
    ).slice(0, 12);
    const usageScenario = analysis.analysisMode?.trim() || analysis.analysisGoal;

    return {
      productName: `${sourceTitle} 精華版`,
      productDescription: dedupe([summary, takeaways, analysisResult.recommendedHook, analysisResult.recommendedCTA]).join(" "),
      targetAudience: analysis.targetAudience?.trim() || "內容受眾",
      priceRange: null,
      usageScenario,
      keywords: keywords.length > 0 ? keywords : [sourceTitle],
      requestedStyle: this.mapToneToContentStyle(analysis.desiredTone)
    };
  }

  private mapToneToContentStyle(tone?: string | null): ContentStyle {
    switch (tone?.trim()) {
      case "高級感":
        return ContentStyle.PREMIUM;
      case "專業型":
        return ContentStyle.EDUCATIONAL;
      case "熱銷帶貨型":
        return ContentStyle.HOT_SALE;
      case "親切型":
      default:
        return ContentStyle.HOT_SALE;
    }
  }

  async getVideo(id: string): Promise<VideoProjectDetail> {
    const project = await this.prisma.videoProject.findUnique({
      where: { id },
      include: {
        content: {
          include: {
            request: true
          }
        },
        segments: {
          orderBy: { segmentIndex: "asc" }
        },
        assets: true,
        output: true
      }
    });

    if (!project) {
      throw new NotFoundException("找不到影片專案");
    }

    await this.tenancyService.assertTenantAccess(
      project.tenantId ?? project.content.tenantId ?? project.content.request.tenantId ?? null
    );

    return {
      id: project.id,
      title: project.title,
      resolvedStyle: project.resolvedStyle,
      mediaMode: project.mediaMode,
      targetDurationSeconds: project.targetDurationSeconds,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      content: {
        id: project.content.id,
        summary: project.content.summary,
        request: {
          productName: project.content.request.productName,
          targetAudience: project.content.request.targetAudience,
          keywords: project.content.request.keywords
        }
      },
      segments: project.segments.map((segment) => ({
        id: segment.id,
        segmentType: segment.segmentType,
        segmentIndex: segment.segmentIndex,
        startSecond: segment.startSecond,
        endSecond: segment.endSecond,
        voiceText: segment.voiceText,
        subtitleText: segment.subtitleText,
        visualPrompt: segment.visualPrompt,
        transition: segment.transition
      })),
      assets: project.assets.map((asset) => ({
        id: asset.id,
        assetType: asset.assetType,
        sourceType: asset.sourceType,
        title: asset.title,
        prompt: asset.prompt,
        durationSeconds: asset.durationSeconds,
        sourceUrl: asset.sourceUrl,
        localPath: asset.localPath
      })),
      output: project.output
        ? {
            id: project.output.id,
            filePath: project.output.filePath,
            publicUrl: project.output.publicUrl,
            width: project.output.width,
            height: project.output.height,
            durationSeconds: project.output.durationSeconds,
            outputFormat: project.output.outputFormat,
            status: project.output.status
          }
        : null
    };
  }

  async listVideos(take = 20, tenantId?: string) {
    await this.tenancyService.assertTenantAccess(tenantId);
    const items = await this.prisma.videoProject.findMany({
      where: tenantId ? { tenantId } : undefined,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        content: {
          include: { request: true }
        },
        output: true
      }
    });

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      style: item.resolvedStyle,
      mediaMode: item.mediaMode,
      durationSeconds: item.targetDurationSeconds,
      createdAt: item.createdAt,
      output: item.output
        ? {
            id: item.output.id,
            filePath: item.output.filePath,
            publicUrl: item.output.publicUrl,
            width: item.output.width,
            height: item.output.height,
            status: item.output.status
          }
        : null,
      content: {
        id: item.content.id,
        productName: item.content.request.productName
      }
    }));
  }

  private resolveVideoStyle(style: string | undefined) {
    switch (style) {
      case "HOT_SALE":
        return VideoStyle.SALES;
      case "PREMIUM":
        return VideoStyle.PREMIUM;
      case "HUMOR":
        return VideoStyle.SOCIAL;
      case "EDUCATIONAL":
        return VideoStyle.TECH;
      case "SALES":
      case "TECH":
      case "SOCIAL":
      case "AUTO":
      default:
        return VideoStyle.SOCIAL;
    }
  }

  private pickScriptVariant(variants: Array<{ id: string; variantType: ContentVariantType; payload: Prisma.JsonValue }>, scriptVariantId?: string | null) {
    if (scriptVariantId) {
      const exact = variants.find((variant) => variant.id === scriptVariantId);
      if (exact?.variantType === ContentVariantType.SCRIPT) {
        return exact;
      }
    }

    return variants.find((variant) => variant.variantType === ContentVariantType.SCRIPT);
  }

  private parseScript(payload: Record<string, unknown>, targetDurationSeconds: 15 | 30): ScriptSegment[] {
    const hook = String(payload.hook ?? "");
    const middle = String(payload.middle ?? "");
    const cta = String(payload.cta ?? "");
    const durationMap = targetDurationSeconds === 30 ? [5, 17, 8] : [3, 8, 4];
    const segments = [
      {
        segmentType: VideoSegmentType.HOOK,
        segmentIndex: 1,
        startSecond: 0,
        endSecond: durationMap[0],
        voiceText: hook,
        subtitleText: hook,
        visualPrompt: `強烈 Hook 字幕，${clipText(hook, 54)}`,
        transition: "quick-cut"
      },
      {
        segmentType: VideoSegmentType.BODY,
        segmentIndex: 2,
        startSecond: durationMap[0],
        endSecond: durationMap[0] + durationMap[1],
        voiceText: middle,
        subtitleText: middle,
        visualPrompt: `商品賣點與使用情境，${clipText(middle, 54)}`,
        transition: "cut"
      },
      {
        segmentType: VideoSegmentType.CTA,
        segmentIndex: 3,
        startSecond: durationMap[0] + durationMap[1],
        endSecond: targetDurationSeconds,
        voiceText: cta,
        subtitleText: cta,
        visualPrompt: `購買引導與品牌收尾，${clipText(cta, 54)}`,
        transition: "fade"
      }
    ];

    return segments;
  }

  private async persistSegmentsAndAssets(
    projectId: string,
    segments: ScriptSegment[],
    keywords: string[],
    style: VideoStyle,
    sceneAssets: SceneMediaAsset[]
  ) {
    await this.prisma.videoSegment.createMany({
      data: segments.map((segment) => ({
        videoProjectId: projectId,
        segmentType: segment.segmentType,
        segmentIndex: segment.segmentIndex,
        startSecond: segment.startSecond,
        endSecond: segment.endSecond,
        text: {
          voiceText: segment.voiceText,
          subtitleText: segment.subtitleText,
          visualPrompt: segment.visualPrompt
        } as Prisma.InputJsonValue,
        voiceText: segment.voiceText,
        subtitleText: segment.subtitleText,
        visualPrompt: segment.visualPrompt,
        transition: segment.transition
      }))
    });

    const assetRows = segments.flatMap((segment) => {
      const sceneKeyword = keywords[segment.segmentIndex - 1] ?? keywords[0] ?? "商品";
      const sceneAsset = sceneAssets[segment.segmentIndex - 1];
      return [
        {
          videoProjectId: projectId,
          segmentId: null,
          assetType: sceneAsset?.assetType ?? (segment.segmentType === VideoSegmentType.CTA ? MediaAssetType.LOGO : MediaAssetType.IMAGE),
          sourceType: sceneAsset?.sourceType ?? MediaSourceType.MOCK,
          title: sceneAsset?.title ?? `${sceneKeyword} 主視覺`,
          sourceUrl: sceneAsset?.sourceUrl ?? null,
          localPath: sceneAsset?.localPath ?? null,
          prompt: sceneAsset?.prompt ?? segment.visualPrompt,
          durationSeconds: segment.endSecond - segment.startSecond,
          metadata: {
            style,
            segmentType: segment.segmentType,
            keyword: sceneKeyword,
            ...sceneAsset?.metadata
          } as Prisma.InputJsonValue
        }
      ];
    });

    await this.prisma.videoAsset.createMany({
      data: assetRows
    });
  }
}
