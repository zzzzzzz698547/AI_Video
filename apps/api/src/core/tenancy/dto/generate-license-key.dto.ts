import { LicensePlan } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class GenerateLicenseKeyDto {
  @IsEnum(LicensePlan)
  plan!: LicensePlan;

  @Transform(({ value }) => parseNumber(value, 1))
  @IsInt()
  @Min(1)
  @Max(200)
  quantity = 1;

  @Transform(({ value }) => parseNumber(value, 1))
  @IsInt()
  @Min(1)
  maxUsers = 1;

  @Transform(({ value }) => parseNumber(value, 10))
  @IsInt()
  @Min(1)
  maxVideos = 10;

  @Transform(({ value }) => parseNumber(value, 3))
  @IsInt()
  @Min(1)
  maxSocialAccounts = 3;

  @IsString()
  @MinLength(10)
  expiresAt!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  prefix?: string;
}
