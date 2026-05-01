import { Injectable, Logger } from "@nestjs/common";
import { MediaAssetType, MediaSourceType, VideoMediaMode, VideoStyle, VideoSegmentType } from "@prisma/client";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { clipText } from "./video.utils";
import { WikimediaMediaLibraryService } from "./providers/wikimedia-media-library.service";
import { OpenAiImageGenerationService } from "./providers/openai-image-generation.service";
import { GeminiImageGenerationService } from "./providers/gemini-image-generation.service";

export interface SceneMediaAsset {
  assetType: MediaAssetType;
  sourceType: MediaSourceType;
  title: string;
  sourceUrl: string | null;
  localPath: string | null;
  prompt: string;
  durationSeconds: number;
  metadata: Record<string, unknown>;
}

interface MediaAssetBuildParams {
  projectId: string;
  title: string;
  style: VideoStyle;
  mediaMode: VideoMediaMode;
  imageProvider?: "AUTO" | "OPENAI" | "GEMINI";
  keywords: string[];
  segments: Array<{
    segmentType: VideoSegmentType;
    segmentIndex: number;
    startSecond: number;
    endSecond: number;
    visualPrompt: string;
    subtitleText: string;
  }>;
}

@Injectable()
export class VideoMediaService {
  private readonly logger = new Logger(VideoMediaService.name);

  constructor(
    private readonly wikimedia: WikimediaMediaLibraryService,
    private readonly openAiImages: OpenAiImageGenerationService,
    private readonly geminiImages: GeminiImageGenerationService
  ) {}

  async buildSceneAssets(params: MediaAssetBuildParams): Promise<SceneMediaAsset[]> {
    const assetRoot = path.join(process.cwd(), "storage", "video-assets", params.projectId);
    await mkdir(assetRoot, { recursive: true });

    const selectedModes = this.resolveModeSequence(params.mediaMode);
    const imageProvider = params.imageProvider ?? "AUTO";
    const results: SceneMediaAsset[] = [];

    for (const segment of params.segments) {
      const mode = selectedModes[(segment.segmentIndex - 1) % selectedModes.length];
      const sceneQuery = this.buildSearchQuery(params.title, params.keywords, segment.subtitleText, segment.visualPrompt);
      const prompt = this.buildImagePrompt(params.style, params.title, segment.visualPrompt, segment.subtitleText, mode);
      const durationSeconds = Math.max(3, segment.endSecond - segment.startSecond);

      if (mode === "AI_IMAGE") {
        const preferredProvider = await this.resolvePreferredProvider(imageProvider);
        try {
          if (preferredProvider === "GEMINI") {
            const generated = await this.geminiImages.generatePortraitImage(prompt, assetRoot);
            if (generated) {
              results.push({
                assetType: MediaAssetType.IMAGE,
                sourceType: MediaSourceType.GENERATIVE,
                title: generated.title,
                sourceUrl: null,
                localPath: generated.localPath,
                prompt,
                durationSeconds,
                metadata: {
                  model: generated.model,
                  provider: "gemini",
                  segmentIndex: segment.segmentIndex,
                  mode,
                  searchQuery: sceneQuery
                }
              });
              continue;
            }
          } else {
            const generated = await this.openAiImages.generatePortraitImage(prompt, assetRoot);
            if (generated) {
              results.push({
                assetType: MediaAssetType.IMAGE,
                sourceType: MediaSourceType.GENERATIVE,
                title: generated.title,
                sourceUrl: null,
                localPath: generated.localPath,
                prompt,
                durationSeconds,
                metadata: {
                  model: generated.model,
                  provider: "openai",
                  segmentIndex: segment.segmentIndex,
                  mode,
                  searchQuery: sceneQuery
                }
              });
              continue;
            }
          }
        } catch (error) {
          this.logger.warn(`AI image generation failed for segment ${segment.segmentIndex}: ${(error as Error).message}`);
        }
      }

      try {
        const libraryAssets = await this.wikimedia.searchAndDownload(sceneQuery, assetRoot, 1);
        const asset = libraryAssets[0];
        if (asset) {
          results.push({
            assetType: asset.mimeType.startsWith("video/") ? MediaAssetType.VIDEO : MediaAssetType.IMAGE,
            sourceType: MediaSourceType.FREE_LIBRARY,
            title: asset.title,
            sourceUrl: asset.sourceUrl,
            localPath: asset.localPath,
            prompt,
            durationSeconds,
            metadata: {
              provider: "wikimedia",
              mimeType: asset.mimeType,
              segmentIndex: segment.segmentIndex,
              mode,
              searchQuery: sceneQuery
            }
          });
          continue;
        }
      } catch (error) {
        this.logger.warn(`Wikimedia download failed for segment ${segment.segmentIndex}: ${(error as Error).message}`);
      }

      results.push({
        assetType: MediaAssetType.IMAGE,
        sourceType: MediaSourceType.MOCK,
        title: `${params.title} - ${segment.segmentType}`,
        sourceUrl: null,
        localPath: null,
        prompt,
        durationSeconds,
        metadata: {
          provider: "mock",
          segmentIndex: segment.segmentIndex,
          mode,
          searchQuery: sceneQuery
        }
      });
    }

    return results;
  }

  private resolveModeSequence(mediaMode: VideoMediaMode) {
    switch (mediaMode) {
      case VideoMediaMode.REAL_MEDIA:
        return ["REAL_MEDIA"];
      case VideoMediaMode.AI_IMAGE:
        return ["AI_IMAGE"];
      case VideoMediaMode.HYBRID:
      default:
        return ["AI_IMAGE", "REAL_MEDIA", "AI_IMAGE"];
    }
  }

  private async resolvePreferredProvider(imageProvider: "AUTO" | "OPENAI" | "GEMINI") {
    if (imageProvider !== "AUTO") {
      return imageProvider;
    }

    const openAiReady = await this.openAiImages.isConfigured();
    if (openAiReady) {
      return "OPENAI";
    }

    const geminiReady = await this.geminiImages.isConfigured();
    if (geminiReady) {
      return "GEMINI";
    }

    return "OPENAI";
  }

  private buildSearchQuery(title: string, keywords: string[], subtitleText: string, visualPrompt: string) {
    const terms = [title, ...keywords.slice(0, 3), subtitleText, visualPrompt]
      .map((item) => clipText(item, 36))
      .filter(Boolean);
    return terms.join(" ");
  }

  private buildImagePrompt(
    style: VideoStyle,
    title: string,
    visualPrompt: string,
    subtitleText: string,
    mode: string
  ) {
    const styleHint =
      style === VideoStyle.PREMIUM
        ? "高級精品質感、乾淨背景、精緻光影"
        : style === VideoStyle.TECH
          ? "科技感、未來 UI、藍綠霓虹、動態線條"
          : style === VideoStyle.SALES
            ? "帶貨感、強對比、商品主體清楚、促購氛圍"
            : "社群感、真實、吸睛、自然生活場景";

    return [
      `9:16 直式短影音背景`,
      `主題: ${title}`,
      `畫面重點: ${visualPrompt}`,
      `字幕暗示: ${subtitleText}`,
      `視覺方向: ${styleHint}`,
      `模式: ${mode}`,
      "避免過度文字、避免拼字錯誤、保持品牌感與商業攝影質感"
    ].join(" | ");
  }
}
