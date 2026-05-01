import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class ActivateLicenseKeyDto {
  @IsString()
  @MinLength(8)
  code!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEmail()
  userEmail!: string;

  @IsString()
  @MinLength(1)
  userName!: string;

  @IsString()
  @MinLength(2)
  tenantName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  workspaceName?: string;
}
