import { VideoMediaMode, VideoSegmentType, VideoStyle } from "@prisma/client";

export interface CreateVideoProjectDtoShape {
  contentId: string;
  scriptVariantId?: string | null;
  targetDurationSeconds: 15 | 30;
  requestedStyle?: VideoStyle;
  mediaMode?: VideoMediaMode;
  imageProvider?: "AUTO" | "OPENAI" | "GEMINI";
}

export interface ScriptSegment {
  segmentType: VideoSegmentType;
  segmentIndex: number;
  startSecond: number;
  endSecond: number;
  voiceText: string;
  subtitleText: string;
  visualPrompt: string;
  transition: string;
}

export interface VideoGenerationResult {
  projectId: string;
  projectStatus: string;
  outputId: string;
  filePath: string;
  publicUrl: string | null;
  durationSeconds: number;
  segments: ScriptSegment[];
}

export interface VideoProjectDetail {
  id: string;
  title: string;
  resolvedStyle: VideoStyle;
  mediaMode: VideoMediaMode;
  targetDurationSeconds: number;
  aspectRatio: string;
  resolution: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  content: {
    id: string;
    summary: string;
    request: {
      productName: string;
      targetAudience: string;
      keywords: string[];
    };
  };
  segments: Array<{
    id: string;
    segmentType: VideoSegmentType;
    segmentIndex: number;
    startSecond: number;
    endSecond: number;
    voiceText: string;
    subtitleText: string;
    visualPrompt: string;
    transition: string;
  }>;
  assets: Array<{
    id: string;
    assetType: string;
    sourceType: string;
    title: string;
    prompt: string;
    durationSeconds: number;
    sourceUrl: string | null;
    localPath: string | null;
  }>;
  output: {
    id: string;
    filePath: string;
    publicUrl: string | null;
    width: number;
    height: number;
    durationSeconds: number;
    outputFormat: string;
    status: string;
  } | null;
}
