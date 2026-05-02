import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ok } from "../http/api-response";
import { AuthService } from "./auth.service";
import { AdminLoginDto } from "./dto/admin-login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("admin/login")
  adminLogin(@Body() body: AdminLoginDto) {
    return ok(this.authService.loginAdmin(body));
  }

  @Get("admin/debug-env")
  adminDebugEnv(@Query("username") username?: string, @Query("password") password?: string) {
    return ok(this.authService.inspectAdminCredentials(username, password));
  }

  @Get("admin/session")
  adminSession(@Query("token") token?: string) {
    if (!token?.trim()) {
      throw new Error("Missing admin token");
    }

    return ok(this.authService.verifyAdminToken(token.trim()));
  }
}
