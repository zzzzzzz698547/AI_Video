import { Injectable, Logger } from "@nestjs/common";
import { MediaAssetType } from "@prisma/client";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { clipText, escapeForSrt, VIDEO_STYLE_CONFIG } from "./video.utils";
import { ScriptSegment } from "./video.types";
import { SystemSpeechTtsService } from "./system-speech-tts.service";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

@Injectable()
export class VideoRenderService {
  private readonly logger = new Logger(VideoRenderService.name);

  constructor(private readonly tts: SystemSpeechTtsService) {}

  async renderProject(params: {
    projectId: string;
    title: string;
    style: keyof typeof VIDEO_STYLE_CONFIG;
    segments: ScriptSegment[];
    durationSeconds: number;
    sceneAssets?: Array<{
      localPath: string | null;
      assetType: MediaAssetType;
      title?: string;
    }>;
  }) {
    const tempRoot = path.join(os.tmpdir(), "ai-vidio", params.projectId, randomUUID());
    const sceneDir = path.join(tempRoot, "scenes");
    const audioDir = path.join(tempRoot, "audio");
    const outDir = path.join(process.cwd(), "storage", "video-outputs");
    const stagingDir = path.join(outDir, "staging");

    await mkdir(sceneDir, { recursive: true });
    await mkdir(audioDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(stagingDir, { recursive: true });

    const subtitlePath = path.join(tempRoot, "subtitles.srt");
    const videoPath = path.join(outDir, `${params.projectId}.mp4`);
    const stagingVideoPath = path.posix.join("storage", "video-outputs", "staging", `${params.projectId}.mp4`);
    const bgmPath = path.join(tempRoot, "bgm.wav");
    const voicePaths: Array<string | null> = [];
    const scenePaths: string[] = [];

    let subtitleIndex = 1;
    let srt = "";
    const styleConfig = VIDEO_STYLE_CONFIG[params.style] ?? VIDEO_STYLE_CONFIG.AUTO;

    for (const segment of params.segments) {
      const sceneAsset = params.sceneAssets?.[segment.segmentIndex - 1];
      const voicePath = path.join(audioDir, `voice-${segment.segmentIndex}.wav`);
      const generatedVoice = await this.tts.synthesize(segment.voiceText, voicePath);
      voicePaths.push(generatedVoice);

      const scenePath = path.join(sceneDir, `scene-${segment.segmentIndex}.mp4`);
      scenePaths.push(scenePath);

      const sceneDuration = Math.max(3, segment.endSecond - segment.startSecond);
      const titleFile = path.join(tempRoot, `scene-${segment.segmentIndex}.txt`);
      await writeFile(
        titleFile,
        `${clipText(segment.subtitleText, 38)}\n${clipText(segment.visualPrompt, 56)}\n${params.title}`,
        "utf8"
      );

      await this.renderScene({
        outputPath: scenePath,
        titleFile,
        durationSeconds: sceneDuration,
        style: styleConfig,
        backgroundPath: sceneAsset?.localPath ?? null,
        backgroundType: sceneAsset?.assetType ?? null
      });

      const start = this.secondsToSrtTime(segment.startSecond);
      const end = this.secondsToSrtTime(segment.endSecond);
      const subtitle = escapeForSrt(segment.subtitleText);
      srt += `${subtitleIndex}\n${start} --> ${end}\n${subtitle}\n\n`;
      subtitleIndex += 1;
    }

    await writeFile(subtitlePath, srt, "utf8");
    await this.renderBgm({ outputPath: bgmPath, durationSeconds: params.durationSeconds, style: styleConfig });

    const finalAudioPath = path.join(tempRoot, "final-audio.m4a");
    await this.mixAudio({
      outputPath: finalAudioPath,
      voicePaths,
      bgmPath,
      durationSeconds: params.durationSeconds
    });

    await this.concatScenes({
      scenePaths,
      subtitlePath,
      audioPath: finalAudioPath,
      outputPath: stagingVideoPath,
      durationSeconds: params.durationSeconds,
      style: styleConfig
    });

    await unlink(videoPath).catch(() => undefined);
    await copyFile(stagingVideoPath, videoPath);

    return {
      videoPath,
      subtitlePath,
      bgmPath,
      finalAudioPath,
      tempRoot
    };
  }

  private renderScene(params: {
    outputPath: string;
    titleFile: string;
    durationSeconds: number;
    style: (typeof VIDEO_STYLE_CONFIG)[keyof typeof VIDEO_STYLE_CONFIG];
    backgroundPath: string | null;
    backgroundType: MediaAssetType | null;
  }) {
    const [base, mid, accent] = params.style.colors;
    return new Promise<void>((resolve, reject) => {
      const pipeline = ffmpeg();
      const hasBackground = Boolean(params.backgroundPath);

      if (hasBackground && params.backgroundPath) {
        const isVideo = params.backgroundType === MediaAssetType.VIDEO;
        pipeline.input(params.backgroundPath);
        if (isVideo) {
          pipeline.inputOptions(["-stream_loop", "-1"]);
        } else {
          pipeline.inputOptions(["-loop", "1"]);
        }
      } else {
        pipeline.input(`color=c=${base}:s=1080x1920:d=${params.durationSeconds}`).inputFormat("lavfi");
      }

      const subtitleText = params.titleFile.replace(/\\/g, "/").replace(/:/g, "\\:");
      const filters = hasBackground
        ? [
            `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.05:saturation=1.05,boxblur=2:1[bg]`,
            `[bg]drawbox=x=0:y=0:w=iw:h=ih:color=${base}@0.15:t=fill,drawbox=x=0:y=0:w=iw:h=180:color=black@0.20:t=fill,drawbox=x=0:y=h-300:w=iw:h=300:color=black@0.25:t=fill[basebg]`,
            `[basebg]drawtext=fontcolor=${accent}:fontsize=48:textfile='${subtitleText}':x=(w-text_w)/2:y=h*0.18:line_spacing=12:box=1:boxcolor=${mid}@0.55:boxborderw=24:shadowx=2:shadowy=2[vout]`
          ]
        : [
            `drawtext=fontcolor=${accent}:fontsize=48:textfile='${subtitleText}':x=(w-text_w)/2:y=h*0.18:line_spacing=12:box=1:boxcolor=${mid}@0.5:boxborderw=24:shadowx=2:shadowy=2`,
            `drawbox=x=0:y=0:w=iw:h=ih:color=${accent}@0.08:t=fill`
          ];

      const command = hasBackground ? pipeline.complexFilter(filters) : pipeline.videoFilter(filters)
      command
        .outputOptions([
          "-y",
          "-pix_fmt yuv420p",
          "-r 30",
          "-c:v libx264",
          "-preset veryfast",
          "-movflags +faststart"
        ])
        .size("1080x1920")
        .duration(params.durationSeconds)
        .save(params.outputPath)
        .on("end", () => resolve())
        .on("error", reject);
    });
  }

  private renderBgm(params: {
    outputPath: string;
    durationSeconds: number;
    style: (typeof VIDEO_STYLE_CONFIG)[keyof typeof VIDEO_STYLE_CONFIG];
  }) {
    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(`sine=frequency=${params.style.bgmFrequency}:sample_rate=44100:duration=${params.durationSeconds}`)
        .inputFormat("lavfi")
        .audioFilters(["volume=0.05"])
        .audioChannels(2)
        .audioFrequency(44100)
        .outputOptions(["-c:a pcm_s16le"])
        .outputOptions(["-y"])
        .save(params.outputPath)
        .on("end", () => resolve())
        .on("error", reject);
    });
  }

  private mixAudio(params: {
    outputPath: string;
    voicePaths: Array<string | null>;
    bgmPath: string;
    durationSeconds: number;
  }) {
    return new Promise<void>((resolve, reject) => {
      const command = ffmpeg();
      const validVoices = params.voicePaths.filter((value): value is string => Boolean(value));

      if (validVoices.length === 0) {
        command.input(`anullsrc=r=44100:cl=stereo:d=${params.durationSeconds}`).inputFormat("lavfi");
      } else {
        validVoices.forEach((voicePath) => command.input(voicePath));
      }

      command.input(params.bgmPath);

      const voiceInputs = validVoices.length === 0 ? 1 : validVoices.length;
      const audioMixInputs = Array.from({ length: voiceInputs + 1 }, (_, index) => `[${index}:a]`).join("");
      const amixInputs = `${audioMixInputs}amix=inputs=${voiceInputs + 1}:duration=longest:dropout_transition=2,volume=1.2[aout]`;

      command
        .complexFilter([amixInputs])
        .outputOptions(["-y", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"])
        .save(params.outputPath)
        .on("end", () => resolve())
        .on("error", reject);
    });
  }

  private async concatScenes(params: {
    scenePaths: string[];
    subtitlePath: string;
    audioPath: string;
    outputPath: string;
    durationSeconds: number;
    style: (typeof VIDEO_STYLE_CONFIG)[keyof typeof VIDEO_STYLE_CONFIG];
  }) {
    const attempt = (burnSubtitles: boolean) =>
      new Promise<void>((resolve, reject) => {
        const pipeline = ffmpeg();
        params.scenePaths.forEach((scenePath) => pipeline.input(scenePath));
        pipeline.input(params.audioPath);

        const sceneLabels = params.scenePaths.map((_, index) => `[${index}:v]`).join("");
        const concatFilter = `${sceneLabels}concat=n=${params.scenePaths.length}:v=1:a=0[vout]`;
        const filters = [concatFilter];

        if (burnSubtitles) {
          filters.push(
            `[vout]subtitles='${params.subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:")}'[video]`
          );
        }

        pipeline
          .on("start", (commandLine) => {
            this.logger.log(commandLine);
          })
          .complexFilter(filters)
          .outputOptions([
            "-y",
            "-map",
            burnSubtitles ? "[video]" : "[vout]",
            "-map",
            `${params.scenePaths.length}:a`,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart"
          ])
          .save(params.outputPath)
          .on("end", () => resolve())
          .on("error", reject);
      });

    try {
      await attempt(true);
    } catch (error) {
      this.logger.warn(`Subtitles burn-in failed for ${params.outputPath}, retrying without subtitles.`);
      await attempt(false);
    }
  }

  private secondsToSrtTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millis = Math.floor((totalSeconds % 1) * 1000);
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":") + `,${String(millis).padStart(3, "0")}`;
  }
}
