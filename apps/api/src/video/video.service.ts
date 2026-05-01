import { Injectable } from "@nestjs/common";
import { CreateVideoProjectDto } from "./video.dto";
import { VideoGeneratorService } from "./video-generator.service";

@Injectable()
export class VideoService {
  constructor(private readonly generator: VideoGeneratorService) {}

  generateVideo(dto: CreateVideoProjectDto) {
    return this.generator.generateVideo(dto);
  }

  getVideo(id: string) {
    return this.generator.getVideo(id);
  }

  listVideos(take = 20, tenantId?: string) {
    return this.generator.listVideos(take, tenantId);
  }
}
