import { SocialPlatform } from "@prisma/client";
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSocialPublishJobDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  adapterId!: string;

  @IsString()
  @MaxLength(2200)
  caption!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
