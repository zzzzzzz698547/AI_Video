import { VideoMediaMode, VideoStyle } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

function parseDuration(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 15;
}

export class CreateVideoProjectDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  analysisId?: string;

  @IsOptional()
  @IsString()
  scriptVariantId?: string;

  @Transform(({ value }) => parseDuration(value))
  @IsInt()
  @Min(15)
  @Max(30)
  targetDurationSeconds: 15 | 30 = 15;

  @IsOptional()
  @IsEnum(VideoStyle)
  requestedStyle?: VideoStyle;

  @IsOptional()
  @IsEnum(VideoMediaMode)
  mediaMode?: VideoMediaMode;

  @IsOptional()
  @IsIn(["AUTO", "OPENAI", "GEMINI"])
  imageProvider?: "AUTO" | "OPENAI" | "GEMINI";
}
