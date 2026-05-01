import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { TenantLicenseGuard } from "../core/tenancy/tenant-license.guard";
import { VideoService } from "./video.service";
import { CreateVideoProjectDto } from "./video.dto";

@Controller()
@UseGuards(TenantLicenseGuard)
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post("generate-video")
  generateVideo(@Body() dto: CreateVideoProjectDto) {
    return this.videoService.generateVideo(dto);
  }

  @Get("video/:id")
  getVideo(@Param("id") id: string) {
    return this.videoService.getVideo(id);
  }

  @Get("videos")
  listVideos(@Query("take") take?: string, @Query("tenantId") tenantId?: string) {
    const limit = Number.isFinite(Number(take)) ? Math.max(1, Math.min(100, Number(take))) : 20;
    return this.videoService.listVideos(limit, tenantId);
  }

  @Get("video/:id/file")
  async streamVideo(@Param("id") id: string, @Res({ passthrough: true }) res: any) {
    const video = await this.videoService.getVideo(id);
    if (!video.output) {
      return { message: "影片尚未完成" };
    }

    res.set({
      "Content-Type": "video/mp4",
      "Content-Disposition": `inline; filename="${video.title}.mp4"`
    });

    return new StreamableFile(createReadStream(video.output.filePath));
  }
}
