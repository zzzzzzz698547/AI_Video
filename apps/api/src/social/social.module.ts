import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SocialController } from "./social.controller";
import { SocialFacebookOAuthController } from "./social-facebook-oauth.controller";
import { SocialFacebookOAuthService } from "./social-facebook-oauth.service";
import { SocialService } from "./social.service";
import { TokenEncryptionService } from "../shared/token-encryption.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SocialController, SocialFacebookOAuthController],
  providers: [SocialService, SocialFacebookOAuthService, TokenEncryptionService],
  exports: [SocialService]
})
export class SocialModule {}
