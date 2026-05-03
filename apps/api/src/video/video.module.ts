import { Module } from "@nestjs/common";
import { VideoController } from "./video.controller";
import { VideoGeneratorService } from "./video-generator.service";
import { VideoRenderService } from "./video-render.service";
import { VideoService } from "./video.service";
import { SystemSpeechTtsService } from "./system-speech-tts.service";
import { VideoMediaService } from "./video-media.service";
import { WikimediaMediaLibraryService } from "./providers/wikimedia-media-library.service";
import { OpenAiImageGenerationService } from "./providers/openai-image-generation.service";
import { GeminiImageGenerationService } from "./providers/gemini-image-generation.service";
import { AiModule } from "../core/ai/ai.module";
import { ContentModule } from "../content/content.module";
import { ObjectStorageService } from "../shared/object-storage.service";

@Module({
  imports: [AiModule, ContentModule],
  controllers: [VideoController],
  providers: [
    VideoService,
    VideoGeneratorService,
    VideoRenderService,
    SystemSpeechTtsService,
    VideoMediaService,
    ObjectStorageService,
    WikimediaMediaLibraryService,
    OpenAiImageGenerationService,
    GeminiImageGenerationService
  ]
})
export class VideoModule {}
