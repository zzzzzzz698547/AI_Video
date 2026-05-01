import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  UrlAnalysisSourceType,
  UrlAnalysisStatus,
  UrlAnalysisVariantType
} from "@prisma/client";
import { AiOrchestratorService } from "../../core/ai/ai-orchestrator.service";
import { TenancyService } from "../../core/tenancy/tenancy.service";
import { PrismaService } from "../../prisma/prisma.service";
import { compactText, dedupe, toHashtag } from "../../content/content.utils";
import { AnalyzeVideoUrlDto } from "./analyze-video-url.dto";
import {
  CutSuggestion,
  HighlightMoment,
  SourceMetadata,
  UrlAnalysisListItem,
  UrlAnalysisResult,
  UrlAnalysisVariant,
  UrlAnalysisVariantPayload,
  AnalyzeVideoUrlInput,
  UrlVerificationResult
} from "./url-analysis.types";
import { VerifyVideoUrlDto } from "./verify-video-url.dto";

type AnalysisContext = {
  input: AnalyzeVideoUrlInput;
  metadata: SourceMetadata;
  topic: string;
  confidenceScore: number;
  recommendedPlatforms: string[];
};

type AiUrlAnalysisOutput = {
  topic?: string;
  summary: string;
  keyTakeaways: string[];
  highlightMoments: HighlightMoment[];
  suggestedCuts: CutSuggestion[];
  recommendedPlatforms: string[];
  recommendedLengthSeconds?: 15 | 30;
  recommendedHook: string;
  recommendedCTA: string;
  confidenceScore?: number;
};

type AnalysisRecord = {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: UrlAnalysisSourceType;
  sourceTitle: string | null;
  sourceDescription: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  targetAudience: string | null;
  desiredTone: string | null;
  desiredLengthSeconds: number;
  focusKeywords: string[];
  status: UrlAnalysisStatus;
  createdAt: Date;
  updatedAt: Date;
  result: {
    id: string;
    requestId: string;
    topic: string;
    summary: string;
    keyTakeaways: string[];
    highlightMoments: unknown;
    suggestedCuts: unknown;
    recommendedPlatforms: string[];
    recommendedLengthSeconds: number;
    recommendedHook: string;
    recommendedCTA: string;
    confidenceScore: number;
    createdAt: Date;
    updatedAt: Date;
    variants: Array<{
      id: string;
      variantType: UrlAnalysisVariantType;
      variantIndex: number;
      title: string | null;
      previewText: string;
      payload: unknown;
      hashtags: string[];
      platforms: string[];
    }>;
  };
};

@Injectable()
export class UrlAnalysisService {
  private readonly logger = new Logger(UrlAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly tenancyService: TenancyService
  ) {}

  async analyze(dto: AnalyzeVideoUrlDto): Promise<UrlAnalysisResult> {
    const resolvedTenantId = dto.tenantId ?? (await this.tenancyService.resolveTenantIdByWorkspace(dto.workspaceId));
    await this.tenancyService.assertTenantAccess(resolvedTenantId);

    const normalizedUrl = this.normalizeUrl(dto.url);
    const metadata = await this.fetchSourceMetadata(normalizedUrl);
    const confidenceScore = this.computeConfidence(metadata, dto);
    const topic = this.buildTopic(metadata, dto);
    const recommendedPlatforms = this.buildRecommendedPlatforms(metadata.sourceType, dto);
    const context: AnalysisContext = {
      input: {
        tenantId: resolvedTenantId ?? undefined,
        workspaceId: dto.workspaceId,
        brandId: dto.brandId,
        url: normalizedUrl,
        analysisGoal: dto.analysisGoal.trim(),
        analysisMode: dto.analysisMode?.trim(),
        targetAudience: dto.targetAudience?.trim(),
        desiredTone: dto.desiredTone?.trim(),
        desiredLengthSeconds: dto.desiredLengthSeconds,
        focusKeywords: dto.focusKeywords
      },
      metadata,
      topic,
      confidenceScore,
      recommendedPlatforms
    };

    if (dto.workspaceId) {
      await this.ensureWorkspaceContext(dto.workspaceId, dto.brandId ?? null, resolvedTenantId);
    }

    const aiAnalysis = await this.generateAiAnalysis(context).catch((error) => {
      this.logger.warn(`AI analysis fallback used: ${(error as Error).message}`);
      return null;
    });

    const summary = aiAnalysis?.summary?.trim() || this.buildSummary(context);
    const keyTakeaways = this.normalizeStringArray(aiAnalysis?.keyTakeaways, this.buildKeyTakeaways(context));
    const highlightMoments = this.normalizeHighlightMoments(aiAnalysis?.highlightMoments, this.buildHighlightMoments(context));
    const suggestedCuts = this.normalizeCutSuggestions(aiAnalysis?.suggestedCuts, this.buildSuggestedCuts(context, highlightMoments));
    const recommendedHook = aiAnalysis?.recommendedHook?.trim() || this.buildHook(context);
    const recommendedCTA = aiAnalysis?.recommendedCTA?.trim() || this.buildCTA(context);
    const recommendedLengthSeconds =
      aiAnalysis?.recommendedLengthSeconds === 15 || aiAnalysis?.recommendedLengthSeconds === 30
        ? aiAnalysis.recommendedLengthSeconds
        : dto.desiredLengthSeconds;
    const aiPlatforms = this.normalizeStringArray(aiAnalysis?.recommendedPlatforms, recommendedPlatforms);
    const finalRecommendedPlatforms = aiPlatforms.length > 0 ? aiPlatforms : recommendedPlatforms;
    const finalTopic = aiAnalysis?.topic?.trim() || topic;
    const finalConfidenceScore = this.normalizeConfidenceScore(aiAnalysis?.confidenceScore ?? confidenceScore);
    const effectiveContext: AnalysisContext = {
      ...context,
      topic: finalTopic,
      confidenceScore: finalConfidenceScore,
      recommendedPlatforms: finalRecommendedPlatforms
    };

    const request = await this.prisma.$transaction(async (tx) => {
      const createdRequest = await tx.videoUrlAnalysisRequest.create({
        data: {
          tenantId: resolvedTenantId ?? null,
          workspaceId: dto.workspaceId ?? null,
          brandId: dto.brandId ?? null,
          sourceUrl: metadata.sourceUrl,
          sourceHost: metadata.sourceHost,
          sourceType: metadata.sourceType,
          sourceTitle: metadata.sourceTitle,
          sourceDescription: metadata.sourceDescription,
          analysisGoal: dto.analysisGoal.trim(),
          analysisMode: dto.analysisMode?.trim() ?? null,
          targetAudience: dto.targetAudience?.trim() ?? null,
          desiredTone: dto.desiredTone?.trim() ?? null,
          desiredLengthSeconds: recommendedLengthSeconds,
          focusKeywords: dto.focusKeywords,
          status: UrlAnalysisStatus.PROCESSING
        }
      });

      const createdResult = await tx.videoUrlAnalysisResult.create({
        data: {
          requestId: createdRequest.id,
          topic: finalTopic,
          summary,
          keyTakeaways,
          highlightMoments: highlightMoments as unknown as never,
          suggestedCuts: suggestedCuts as unknown as never,
          recommendedPlatforms: finalRecommendedPlatforms,
          recommendedLengthSeconds,
          recommendedHook,
          recommendedCTA,
          confidenceScore: finalConfidenceScore
        }
      });

      const variants = [
        ...this.buildTitleVariants(effectiveContext),
        ...this.buildHighlightVariants(effectiveContext, highlightMoments),
        ...this.buildScriptVariants(effectiveContext),
        ...this.buildCutPlanVariants(effectiveContext, suggestedCuts)
      ];

      await tx.videoUrlAnalysisVariant.createMany({
        data: variants.map((variant) => ({
          videoUrlAnalysisResultId: createdResult.id,
          variantType: variant.variantType,
          variantIndex: variant.variantIndex,
          title: variant.title ?? null,
          previewText: variant.previewText,
          payload: variant.payload as never,
          hashtags: variant.hashtags,
          platforms: variant.platforms
        }))
      });

      return tx.videoUrlAnalysisRequest.update({
        where: { id: createdRequest.id },
        data: {
          status: UrlAnalysisStatus.READY,
          errorMessage: null
        }
      });
    });

    return this.getAnalysis(request.id);
  }

  async verify(dto: VerifyVideoUrlDto): Promise<UrlVerificationResult> {
    const resolvedTenantId = dto.tenantId ?? (await this.tenancyService.resolveTenantIdByWorkspace(dto.workspaceId));
    await this.tenancyService.assertTenantAccess(resolvedTenantId);
    const normalizedUrl = this.normalizeUrl(dto.url);
    const metadata = await this.fetchSourceMetadata(normalizedUrl);

    return {
      verified: true,
      normalizedUrl,
      sourceUrl: metadata.sourceUrl,
      sourceHost: metadata.sourceHost,
      sourceType: metadata.sourceType,
      sourceTitle: metadata.sourceTitle,
      sourceDescription: metadata.sourceDescription,
      sourceImage: metadata.sourceImage,
      confidence: metadata.confidence,
      message: "已確認讀取"
    };
  }

  private async generateAiAnalysis(context: AnalysisContext): Promise<AiUrlAnalysisOutput | null> {
    const prompt = this.buildAiPrompt(context);
    const result = await this.aiOrchestrator.generate<
      {
        sourceUrl: string;
        sourceHost: string;
        sourceType: string;
        sourceTitle: string | null;
        sourceDescription: string | null;
        analysisGoal: string;
        analysisMode: string | null;
        targetAudience: string | null;
        desiredTone: string | null;
        desiredLengthSeconds: number;
        focusKeywords: string[];
        topic: string;
      },
      AiUrlAnalysisOutput
    >({
      module: "content",
      workspaceId: context.input.workspaceId,
      brandId: context.input.brandId,
      tone: context.input.desiredTone ?? "親切",
      style: context.input.analysisMode ?? "精華剪輯",
      responseFormat: "json",
      prompt,
      input: {
        sourceUrl: context.metadata.sourceUrl,
        sourceHost: context.metadata.sourceHost,
        sourceType: context.metadata.sourceType,
        sourceTitle: context.metadata.sourceTitle,
        sourceDescription: context.metadata.sourceDescription,
        analysisGoal: context.input.analysisGoal,
        analysisMode: context.input.analysisMode ?? null,
        targetAudience: context.input.targetAudience ?? null,
        desiredTone: context.input.desiredTone ?? null,
        desiredLengthSeconds: context.input.desiredLengthSeconds,
        focusKeywords: context.input.focusKeywords,
        topic: context.topic
      }
    });

    return this.normalizeAiOutput(result.output);
  }

  private buildAiPrompt(context: AnalysisContext) {
    const keywords = context.input.focusKeywords.length > 0 ? context.input.focusKeywords.join("、") : "無";

    return [
      "你是 AI-VIDIO 的短影音網址分析引擎。",
      "請根據提供的來源標題、描述、網址與使用者分析目標，產出可直接用於剪輯與發佈的分析結果。",
      "嚴格要求：",
      "1. 只輸出純 JSON，不能有 markdown、註解或額外文字。",
      "2. 全部內容請使用繁體中文。",
      "3. 不要虛構原文逐字稿或不存在的精確時間碼；若沒有字幕資訊，請用可執行的區段建議。",
      "4. 每個 highlightMoments / suggestedCuts 都要是實際可剪輯、可改寫的內容。",
      "5. recommendedPlatforms 請給 2~4 個最適合的平台。",
      "6. confidenceScore 請回傳 0 到 1 之間的小數，保留到小數點後兩位。",
      "",
      "JSON 格式：",
      "{",
      '  "topic": "string",',
      '  "summary": "string",',
      '  "keyTakeaways": ["string"],',
      '  "highlightMoments": [',
      "    {",
      '      "title": "string",',
      '      "reason": "string",',
      '      "visualSuggestion": "string",',
      '      "startHint": "string",',
      '      "endHint": "string",',
      '      "quote": "string | null"',
      "    }",
      "  ],",
      '  "suggestedCuts": [',
      "    {",
      '      "title": "string",',
      '      "description": "string",',
      '      "startHint": "string",',
      '      "endHint": "string",',
      '      "angle": "string"',
      "    }",
      "  ],",
      '  "recommendedPlatforms": ["string"],',
      '  "recommendedLengthSeconds": 15,',
      '  "recommendedHook": "string",',
      '  "recommendedCTA": "string",',
      '  "confidenceScore": 0.82',
      "}",
      "",
      "來源資訊：",
      `- 網址：${context.metadata.sourceUrl}`,
      `- 主機：${context.metadata.sourceHost}`,
      `- 類型：${context.metadata.sourceType}`,
      `- 標題：${context.metadata.sourceTitle ?? "未知"}`,
      `- 描述：${context.metadata.sourceDescription ?? "無"}`,
      `- 分析目標：${context.input.analysisGoal}`,
      `- 分析模式：${context.input.analysisMode ?? "未指定"}`,
      `- 目標族群：${context.input.targetAudience ?? "未指定"}`,
      `- 語氣：${context.input.desiredTone ?? "未指定"}`,
      `- 預期長度：${context.input.desiredLengthSeconds} 秒`,
      `- 關鍵字：${keywords}`,
      "",
      "請先理解內容價值，再輸出適合台灣市場、可直接拿去生成短影音的結果。"
    ].join("\n");
  }

  private normalizeAiOutput(output: AiUrlAnalysisOutput): AiUrlAnalysisOutput {
    return {
      topic: output.topic?.trim() || undefined,
      summary: output.summary?.trim() || "",
      keyTakeaways: this.normalizeStringArray(output.keyTakeaways, []),
      highlightMoments: this.normalizeHighlightMoments(output.highlightMoments, []),
      suggestedCuts: this.normalizeCutSuggestions(output.suggestedCuts, []),
      recommendedPlatforms: this.normalizeStringArray(output.recommendedPlatforms, []),
      recommendedLengthSeconds:
        output.recommendedLengthSeconds === 15 || output.recommendedLengthSeconds === 30
          ? output.recommendedLengthSeconds
          : undefined,
      recommendedHook: output.recommendedHook?.trim() || "",
      recommendedCTA: output.recommendedCTA?.trim() || "",
      confidenceScore: this.normalizeConfidenceScore(output.confidenceScore)
    };
  }

  private normalizeStringArray(values: string[] | undefined | null, fallback: string[]) {
    const cleaned = dedupe((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value)));
    return cleaned.length > 0 ? cleaned : fallback;
  }

  private normalizeHighlightMoments(values: HighlightMoment[] | undefined | null, fallback: HighlightMoment[]) {
    const cleaned = (values ?? [])
      .map((value) => ({
        title: value?.title?.trim() || "",
        reason: value?.reason?.trim() || "",
        visualSuggestion: value?.visualSuggestion?.trim() || "",
        startHint: value?.startHint?.trim() || "",
        endHint: value?.endHint?.trim() || "",
        quote: value?.quote?.trim() || null
      }))
      .filter((value) => value.title && value.reason && value.visualSuggestion);

    return cleaned.length > 0 ? cleaned.slice(0, 3) : fallback;
  }

  private normalizeCutSuggestions(values: CutSuggestion[] | undefined | null, fallback: CutSuggestion[]) {
    const cleaned = (values ?? [])
      .map((value) => ({
        title: value?.title?.trim() || "",
        description: value?.description?.trim() || "",
        startHint: value?.startHint?.trim() || "",
        endHint: value?.endHint?.trim() || "",
        angle: value?.angle?.trim() || ""
      }))
      .filter((value) => value.title && value.description && value.startHint && value.endHint && value.angle);

    return cleaned.length > 0 ? cleaned.slice(0, 4) : fallback;
  }

  private normalizeConfidenceScore(value: number | undefined | null) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0.72;
    }

    return Math.max(0.35, Math.min(0.98, Number(value.toFixed(2))));
  }

  async listAnalyses(take = 20, tenantId?: string): Promise<UrlAnalysisListItem[]> {
    await this.tenancyService.assertTenantAccess(tenantId);
    const items = await this.prisma.videoUrlAnalysisRequest.findMany({
      where: tenantId ? { tenantId } : undefined,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        result: true
      }
    });

    return items.map((item) => ({
      id: item.id,
      sourceUrl: item.sourceUrl,
      sourceHost: item.sourceHost,
      sourceType: item.sourceType,
      sourceTitle: item.sourceTitle,
      analysisGoal: item.analysisGoal,
      analysisMode: item.analysisMode,
      status: item.status,
      confidenceScore: item.result?.confidenceScore ?? 0,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }));
  }

  async getAnalysis(id: string): Promise<UrlAnalysisResult> {
    const request = await this.prisma.videoUrlAnalysisRequest.findUnique({
      where: { id },
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

    if (!request || !request.result) {
      throw new NotFoundException("找不到影片網址分析結果");
    }

    await this.tenancyService.assertTenantAccess(request.tenantId ?? null);

    return this.mapResult(request as AnalysisRecord);
  }

  private mapResult(request: AnalysisRecord): UrlAnalysisResult {
    return {
      id: request.result.id,
      requestId: request.id,
      status: request.status,
      sourceUrl: request.sourceUrl,
      sourceHost: request.sourceHost,
      sourceType: request.sourceType,
      sourceTitle: request.sourceTitle,
      sourceDescription: request.sourceDescription,
      analysisGoal: request.analysisGoal,
      analysisMode: request.analysisMode,
      targetAudience: request.targetAudience,
      desiredTone: request.desiredTone,
      desiredLengthSeconds: request.desiredLengthSeconds,
      focusKeywords: request.focusKeywords,
      topic: request.result.topic,
      summary: request.result.summary,
      keyTakeaways: request.result.keyTakeaways,
      highlightMoments: (request.result.highlightMoments as HighlightMoment[]) ?? [],
      suggestedCuts: (request.result.suggestedCuts as CutSuggestion[]) ?? [],
      recommendedPlatforms: request.result.recommendedPlatforms,
      recommendedLengthSeconds: request.result.recommendedLengthSeconds,
      recommendedHook: request.result.recommendedHook,
      recommendedCTA: request.result.recommendedCTA,
      confidenceScore: request.result.confidenceScore,
      variants: request.result.variants.map((variant) => ({
        id: variant.id,
        variantType: variant.variantType,
        variantIndex: variant.variantIndex,
        title: variant.title,
        previewText: variant.previewText,
        payload: variant.payload as UrlAnalysisVariantPayload,
        hashtags: variant.hashtags,
        platforms: variant.platforms
      })),
      createdAt: request.result.createdAt.toISOString(),
      updatedAt: request.result.updatedAt.toISOString()
    };
  }

  private buildSummary(context: AnalysisContext) {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const focus = context.input.analysisMode ?? context.input.analysisGoal;
    const audience = context.input.targetAudience ? `，特別適合 ${context.input.targetAudience}` : "";

    return `${title} 的核心內容可以先從「${focus}」切入${audience}。系統已抓出最適合剪成短影音與精華段落的重點，方便你直接產出標題、腳本與剪輯建議。`;
  }

  private buildKeyTakeaways(context: AnalysisContext) {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const goal = context.input.analysisGoal;
    const keywords = context.input.focusKeywords.slice(0, 3).join("、");
    const audience = context.input.targetAudience ?? "目標族群";

    return dedupe([
      `這支影片的主軸可先定義為 ${title}，適合先抓「${goal}」這個角度。`,
      `最值得保留的精華，會是開場鉤子、核心觀點與最後的轉換提醒。`,
      keywords ? `關鍵字已對齊：${keywords}，有助於後續標題與 hashtag 延伸。` : "",
      `若要做成短影音，建議先鎖定 ${audience} 最在意的痛點，再收斂成 15 / 30 秒版本。`
    ]).slice(0, 4);
  }

  private buildHighlightMoments(context: AnalysisContext): HighlightMoment[] {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const goal = context.input.analysisGoal;
    const tone = context.input.desiredTone ?? "自然";
    const focus = context.input.analysisMode ?? "精華剪輯";
    const firstKeyword = context.input.focusKeywords[0] ?? goal;

    return [
      {
        title: "開場鉤子",
        reason: `先把 ${title} 的第一個重點拉出來，讓觀眾立刻知道這支片的價值。`,
        visualSuggestion: `${focus} 開場先做高對比字幕，直接點出 ${firstKeyword}。`,
        startHint: "0% - 12%",
        endHint: "12% - 20%",
        quote: `${tone} 語氣可保留，但開頭要更快更直接。`
      },
      {
        title: "核心精華",
        reason: `把影片中最能解決 ${goal} 的段落單獨剪出來，形成完整精華。`,
        visualSuggestion: `中段建議搭配重點字卡與補充 B-roll。`,
        startHint: "20% - 68%",
        endHint: "68% - 82%",
        quote: `這一段通常是轉換與停留最強的位置。`
      },
      {
        title: "結尾 CTA",
        reason: `把觀眾從資訊吸收帶到下一步行動，例如收藏、留言、私訊或點連結。`,
        visualSuggestion: "結尾可以補品牌字樣、關鍵 CTA 與下一步指引。",
        startHint: "82% - 100%",
        endHint: "100%",
        quote: `這裡適合直接收束成行動句。`
      }
    ];
  }

  private buildSuggestedCuts(context: AnalysisContext, highlights: HighlightMoment[]): CutSuggestion[] {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const focus = context.input.analysisMode ?? "精華剪輯";

    return [
      {
        title: "15 秒 Hook 版",
        description: `從 ${title} 的開頭與第一個衝突點切入，適合做成短爆款版本。`,
        startHint: highlights[0]?.startHint ?? "0% - 12%",
        endHint: highlights[1]?.startHint ?? "20% - 68%",
        angle: `${focus} / 開場先抓注意`
      },
      {
        title: "30 秒精華版",
        description: `保留核心觀點與一個最有價值的例子，適合 Reels / Shorts / TikTok。`,
        startHint: highlights[0]?.startHint ?? "0% - 12%",
        endHint: highlights[2]?.startHint ?? "82% - 100%",
        angle: `${focus} / 完整精華`
      },
      {
        title: "轉換版",
        description: `把最能導流或促成下一步的段落單獨剪出來，適合放 CTA。`,
        startHint: highlights[1]?.startHint ?? "20% - 68%",
        endHint: highlights[2]?.endHint ?? "100%",
        angle: `${focus} / 行動導向`
      }
    ];
  }

  private buildTitleVariants(context: AnalysisContext): Array<UrlAnalysisVariant & { variantType: UrlAnalysisVariantType }> {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const goal = context.input.analysisGoal;
    const audience = context.input.targetAudience ?? "這群人";
    const keyword = context.input.focusKeywords[0] ?? goal;
    const hostLabel = this.sourceTypeLabel(context.metadata.sourceType);
    const mode = context.input.analysisMode ?? "精華剪輯";
    const tags = this.buildHashtags(context, [title, keyword, goal], ["標題", "精華", "短影音"]);

    const titles = dedupe([
      `這支${hostLabel}影片到底在講什麼？先看最精華的 3 分鐘`,
      `${title} 精華整理：最值得剪成短影音的地方`,
      `如果你也在找 ${goal}，這支影片直接看這 3 個重點`,
      `別直接滑過：${audience} 最容易有感的片段都在這裡`,
      `${mode}完成版：${keyword} 的亮點一次看懂`
    ]).slice(0, 5);

    return titles.map((variantTitle, index) => ({
      id: "",
      variantType: UrlAnalysisVariantType.TITLE,
      variantIndex: index + 1,
      title: variantTitle,
      previewText: variantTitle,
      payload: {
        title: variantTitle,
        angle: index === 0 ? "開場好奇" : index === 1 ? "精華整理" : index === 2 ? "需求對焦" : index === 3 ? "族群共鳴" : "轉換導向",
        rationale: index === 0 ? "先用問句吸住點擊。" : index === 1 ? "直接讓使用者知道這是精華版。" : index === 2 ? "把分析目標放進標題。" : index === 3 ? "打中目標族群痛點。" : "讓結果更像可轉換的內容。"
      },
      hashtags: tags,
      platforms: this.buildRecommendedPlatforms(context.metadata.sourceType, context.input)
    }));
  }

  private buildHighlightVariants(context: AnalysisContext, moments: HighlightMoment[]) {
    const tags = this.buildHashtags(context, [context.topic], ["精華", "亮點", "剪輯"]);

    return moments.slice(0, 3).map((moment, index) => ({
      id: "",
      variantType: UrlAnalysisVariantType.HIGHLIGHT,
      variantIndex: index + 1,
      title: moment.title,
      previewText: moment.reason,
      payload: {
        title: moment.title,
        reason: moment.reason,
        visualSuggestion: moment.visualSuggestion,
        startHint: moment.startHint,
        endHint: moment.endHint,
        titleHint: moment.quote ?? ""
      },
      hashtags: tags,
      platforms: this.buildRecommendedPlatforms(context.metadata.sourceType, context.input)
    }));
  }

  private buildScriptVariants(context: AnalysisContext): Array<UrlAnalysisVariant & { variantType: UrlAnalysisVariantType }> {
    const title = context.metadata.sourceTitle ?? this.fallbackTitle(context.metadata.sourceUrl);
    const goal = context.input.analysisGoal;
    const audience = context.input.targetAudience ?? "觀眾";
    const hookFocus = context.input.focusKeywords[0] ?? goal;
    const cta = context.input.desiredTone ?? "先收藏，晚點回來看重點";
    const tags = this.buildHashtags(context, [title, goal, hookFocus], ["腳本", "Reels", "Shorts"]);
    const platforms = this.buildRecommendedPlatforms(context.metadata.sourceType, context.input);

    const items = [
      {
        title: `${title} 15 秒精華腳本`,
        hook: `先停 3 秒，這支影片最值得看的不是開頭，而是 ${hookFocus}。`,
        middle: `中段直接把 ${title} 裡最能解決 ${goal} 的重點拆開，讓 ${audience} 一眼看懂。`,
        cta: `結尾可以直接說：${cta}。`,
        angle: "15 秒快切"
      },
      {
        title: `${title} 30 秒分析腳本`,
        hook: `如果你想快速看懂這支影片，先抓 ${hookFocus} 這個角度。`,
        middle: `把來源內容整理成 3 個重點：問題、解法、可執行下一步，這樣最容易做成短影音。`,
        cta: `最後接上明確行動句，像是「要我幫你再拆更細，留言關鍵字」`,
        angle: "30 秒完整版"
      },
      {
        title: `${title} 轉換導向腳本`,
        hook: `很多人看完只記得表面，但真正有價值的是 ${goal} 的那一段。`,
        middle: `把最能轉換或最有情緒張力的片段拉出來，前後加上字幕與關鍵字。`,
        cta: `如果這支有幫到你，先收藏，下一支我直接幫你拆成可發布版本。`,
        angle: "轉單導向"
      }
    ];

    return items.map((item, index) => ({
      id: "",
      variantType: UrlAnalysisVariantType.SCRIPT,
      variantIndex: index + 1,
      title: item.title,
      previewText: item.hook,
      payload: {
        title: item.title,
        hook: item.hook,
        middle: item.middle,
        cta: item.cta,
        angle: item.angle,
        structure: ["Hook (0-3秒)", "中段內容 (3-10秒)", "CTA (10-15秒)"]
      },
      hashtags: tags,
      platforms
    }));
  }

  private buildCutPlanVariants(context: AnalysisContext, cuts: CutSuggestion[]) {
    const tags = this.buildHashtags(context, [context.metadata.sourceTitle ?? "", context.input.analysisGoal], ["剪點", "cut", "精華"]);
    const platforms = this.buildRecommendedPlatforms(context.metadata.sourceType, context.input);

    return cuts.map((cut, index) => ({
      id: "",
      variantType: UrlAnalysisVariantType.CUT_PLAN,
      variantIndex: index + 1,
      title: cut.title,
      previewText: cut.description,
      payload: {
        title: cut.title,
        reason: cut.description,
        startHint: cut.startHint,
        endHint: cut.endHint,
        angle: cut.angle
      },
      hashtags: tags,
      platforms
    }));
  }

  private buildCTA(context: AnalysisContext) {
    const goal = context.input.analysisGoal;
    const mode = context.input.analysisMode ?? "精華剪輯";
    const audience = context.input.targetAudience ?? "你";
    if (/銷售|轉換|帶貨|成交/.test(goal + mode)) {
      return `${audience} 如果想看完整拆解或直接做成可發佈版本，先收藏，或留言「分析」我幫你再延伸。`;
    }
    return `${audience} 如果想把這支影片做成更完整的精華版，先收藏，下一步就能直接轉成短影音。`;
  }

  private buildHook(context: AnalysisContext) {
    const keyword = context.input.focusKeywords[0] ?? context.input.analysisGoal;
    return `先別急著看完，這支影片真正該抓的精華，其實是 ${keyword}。`;
  }

  private buildRecommendedPlatforms(sourceType: UrlAnalysisSourceType, input: AnalyzeVideoUrlInput) {
    const base = (() => {
      switch (sourceType) {
        case UrlAnalysisSourceType.YOUTUBE:
          return ["TikTok", "IG", "Reels", "Shorts"];
        case UrlAnalysisSourceType.TIKTOK:
          return ["TikTok", "IG", "Reels"];
        case UrlAnalysisSourceType.INSTAGRAM:
          return ["IG", "Reels", "Threads"];
        case UrlAnalysisSourceType.FACEBOOK:
          return ["FB", "IG", "Reels"];
        case UrlAnalysisSourceType.THREADS:
          return ["Threads", "IG", "FB"];
        default:
          return ["IG", "Threads", "TikTok"];
      }
    })();

    if ((input.analysisMode ?? "").includes("標題")) {
      return base.slice(0, 3);
    }

    return base;
  }

  private buildHashtags(context: AnalysisContext, seeds: string[], extras: string[]) {
    const baseTags = [
      ...seeds,
      ...context.input.focusKeywords,
      context.input.targetAudience ?? "",
      context.input.analysisGoal,
      context.input.analysisMode ?? "",
      ...extras,
      this.sourceTypeLabel(context.metadata.sourceType)
    ];

    return dedupe(baseTags.map((token) => toHashtag(token)).filter(Boolean)).slice(0, 20);
  }

  private buildTopic(metadata: SourceMetadata, dto: AnalyzeVideoUrlDto) {
    const sourceTitle = metadata.sourceTitle ?? this.fallbackTitle(metadata.sourceUrl);
    const keyword = dto.focusKeywords[0] ? `#${dto.focusKeywords[0]}` : null;
    const raw = compactText([sourceTitle, dto.analysisGoal, dto.analysisMode, keyword ?? undefined]);
    return raw.slice(0, 120) || dto.analysisGoal;
  }

  private computeConfidence(metadata: SourceMetadata, dto: AnalyzeVideoUrlDto) {
    let score = metadata.confidence;
    if (dto.analysisGoal.trim()) score += 0.1;
    if (dto.focusKeywords.length > 0) score += 0.05;
    if (dto.analysisMode) score += 0.05;
    return Math.max(0.35, Math.min(0.95, Number(score.toFixed(2))));
  }

  private normalizeUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error("URL 不可為空");
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  private async fetchSourceMetadata(sourceUrl: string): Promise<SourceMetadata> {
    try {
      const parsedUrl = new URL(sourceUrl);
      const host = parsedUrl.hostname.replace(/^www\./, "");
      const sourceType = this.detectSourceType(host, sourceUrl);

      if (sourceType === UrlAnalysisSourceType.YOUTUBE) {
        const youtube = await this.fetchYouTubeOEmbed(sourceUrl);
        if (youtube) {
          return {
            sourceUrl,
            sourceHost: host,
            sourceType,
      sourceTitle: youtube.title ?? null,
      sourceDescription: youtube.author_name ? `作者：${youtube.author_name}` : youtube.title ?? null,
            sourceImage: youtube.thumbnail_url ?? null,
            confidence: 0.92
          };
        }
      }

      const html = await this.fetchHtml(sourceUrl);
      const title = this.extractHtmlTitle(html);
      const description = this.extractMetaDescription(html);
      const image = this.extractMetaProperty(html, "og:image") ?? this.extractMetaProperty(html, "twitter:image");

      return {
        sourceUrl,
        sourceHost: host,
        sourceType,
        sourceTitle: title,
        sourceDescription: description,
        sourceImage: image,
        confidence: title || description ? 0.78 : 0.55
      };
    } catch {
      try {
        const parsedUrl = new URL(sourceUrl);
        const host = parsedUrl.hostname.replace(/^www\./, "");
        return {
          sourceUrl,
          sourceHost: host,
          sourceType: this.detectSourceType(host, sourceUrl),
          sourceTitle: this.fallbackTitle(sourceUrl),
          sourceDescription: null,
          sourceImage: null,
          confidence: 0.5
        };
      } catch {
        return {
          sourceUrl,
          sourceHost: "unknown",
          sourceType: UrlAnalysisSourceType.GENERIC,
          sourceTitle: this.fallbackTitle(sourceUrl),
          sourceDescription: null,
          sourceImage: null,
          confidence: 0.35
        };
      }
    }
  }

  private async fetchYouTubeOEmbed(sourceUrl: string) {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`;
    try {
      const response = await this.fetchWithTimeout(endpoint);
      if (!response.ok) {
        return null;
      }

      return (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
    } catch {
      return null;
    }
  }

  private async fetchHtml(sourceUrl: string) {
    try {
      const response = await this.fetchWithTimeout(sourceUrl);
      if (!response.ok) {
        return "";
      }
      return await response.text();
    } catch {
      return "";
    }
  }

  private async fetchWithTimeout(url: string, timeoutMs = 4000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private detectSourceType(host: string, sourceUrl: string) {
    const normalized = `${host} ${sourceUrl}`.toLowerCase();
    if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
      return UrlAnalysisSourceType.YOUTUBE;
    }
    if (normalized.includes("tiktok.com")) {
      return UrlAnalysisSourceType.TIKTOK;
    }
    if (normalized.includes("instagram.com")) {
      return UrlAnalysisSourceType.INSTAGRAM;
    }
    if (normalized.includes("facebook.com") || normalized.includes("fb.watch")) {
      return UrlAnalysisSourceType.FACEBOOK;
    }
    if (normalized.includes("threads.net")) {
      return UrlAnalysisSourceType.THREADS;
    }
    if (normalized.includes("vimeo.com")) {
      return UrlAnalysisSourceType.VIMEO;
    }
    return UrlAnalysisSourceType.GENERIC;
  }

  private extractHtmlTitle(html: string) {
    const ogTitle = this.extractMetaProperty(html, "og:title");
    if (ogTitle) {
      return ogTitle;
    }

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (!titleMatch) {
      return null;
    }

    return this.cleanText(this.decodeHtmlEntities(titleMatch[1]));
  }

  private extractMetaDescription(html: string) {
    const ogDescription = this.extractMetaProperty(html, "og:description") ?? this.extractMetaProperty(html, "twitter:description");
    if (ogDescription) {
      return ogDescription;
    }

    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    return metaMatch ? this.cleanText(this.decodeHtmlEntities(metaMatch[1])) : null;
  }

  private extractMetaProperty(html: string, property: string) {
    const propertyRegex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const match = html.match(propertyRegex);
    return match ? this.cleanText(this.decodeHtmlEntities(match[1])) : null;
  }

  private decodeHtmlEntities(text: string) {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  private cleanText(text: string) {
    return text.replace(/\s+/g, " ").trim();
  }

  private fallbackTitle(sourceUrl: string) {
    try {
      const parsed = new URL(sourceUrl);
      const slug = parsed.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => part.replace(/[-_]+/g, " "))
        .join(" ");
      return this.cleanText(slug || parsed.hostname.replace(/^www\./, ""));
    } catch {
      return sourceUrl;
    }
  }

  private sourceTypeLabel(sourceType: UrlAnalysisSourceType) {
    switch (sourceType) {
      case UrlAnalysisSourceType.YOUTUBE:
        return "YouTube";
      case UrlAnalysisSourceType.TIKTOK:
        return "TikTok";
      case UrlAnalysisSourceType.INSTAGRAM:
        return "Instagram";
      case UrlAnalysisSourceType.FACEBOOK:
        return "Facebook";
      case UrlAnalysisSourceType.THREADS:
        return "Threads";
      case UrlAnalysisSourceType.VIMEO:
        return "Vimeo";
      default:
        return "Generic";
    }
  }

  private async ensureWorkspaceContext(workspaceId: string, brandId: string | null, tenantId?: string | null) {
    await this.prisma.user.upsert({
      where: { email: "demo-owner@ai-vidio.local" },
      create: {
        id: "demo-owner",
        email: "demo-owner@ai-vidio.local",
        name: "Demo Owner",
        status: "ACTIVE"
      },
      update: {
        name: "Demo Owner",
        status: "ACTIVE"
      }
    });

    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      create: {
        id: workspaceId,
        ownerId: "demo-owner",
        tenantId: tenantId ?? null,
        name: workspaceId === "demo-workspace" ? "Demo Workspace" : workspaceId,
        slug: workspaceId
      },
      update: {
        tenantId: tenantId ?? undefined,
        name: workspaceId === "demo-workspace" ? "Demo Workspace" : workspaceId,
        status: "ACTIVE"
      }
    });

    if (brandId) {
      await this.prisma.brand.upsert({
        where: {
          workspaceId_slug: {
            workspaceId,
            slug: brandId
          }
        },
        create: {
          id: brandId,
          workspaceId,
          name: this.resolveBrandName(brandId),
          slug: brandId
        },
        update: {
          name: this.resolveBrandName(brandId),
          status: "ACTIVE"
        }
      });
    }
  }

  private resolveBrandName(brandId: string) {
    switch (brandId) {
      case "demo-brand":
        return "預設品牌";
      case "beauty-brand":
        return "美妝品牌";
      case "tech-brand":
        return "科技品牌";
      default:
        return brandId;
    }
  }
}
