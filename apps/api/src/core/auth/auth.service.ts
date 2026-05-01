import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AdminLoginDto } from "./dto/admin-login.dto";

type AdminSessionPayload = {
  sub: string;
  role: "SUPER_ADMIN";
  username: string;
  displayName: string;
  iat: number;
  exp: number;
};

@Injectable()
export class AuthService {
  private static readonly SESSION_TTL_MS = 1000 * 60 * 60 * 12;

  loginAdmin(input: AdminLoginDto) {
    const configuredUsername = process.env.ADMIN_LOGIN_USERNAME?.trim();
    const configuredPassword = process.env.ADMIN_LOGIN_PASSWORD?.trim();

    if (!configuredUsername || !configuredPassword) {
      throw new UnauthorizedException("管理員登入尚未設定，請先填入 ADMIN_LOGIN_USERNAME / ADMIN_LOGIN_PASSWORD");
    }

    if (input.username.trim() !== configuredUsername || input.password !== configuredPassword) {
      throw new UnauthorizedException("帳號或密碼錯誤");
    }

    return this.createSession(configuredUsername);
  }

  verifyAdminToken(token: string) {
    const session = this.decodeAndVerifyToken(token);
    const now = Date.now();

    if (session.exp <= now) {
      throw new UnauthorizedException("管理員登入已過期，請重新登入");
    }

    return {
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      expiresAt: new Date(session.exp).toISOString()
    };
  }

  private createSession(username: string) {
    const now = Date.now();
    const payload: AdminSessionPayload = {
      sub: "admin",
      role: "SUPER_ADMIN",
      username,
      displayName: process.env.ADMIN_LOGIN_DISPLAY_NAME?.trim() || "System Admin",
      iat: now,
      exp: now + AuthService.SESSION_TTL_MS
    };

    const token = this.signPayload(payload);

    return {
      token,
      user: {
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role
      },
      expiresAt: new Date(payload.exp).toISOString()
    };
  }

  private signPayload(payload: AdminSessionPayload) {
    const encodedPayload = this.toBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  private decodeAndVerifyToken(token: string) {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("管理員登入憑證格式錯誤");
    }

    const expectedSignature = this.sign(encodedPayload);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException("管理員登入憑證驗證失敗");
    }

    try {
      const raw = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
      return raw;
    } catch {
      throw new UnauthorizedException("管理員登入憑證內容無效");
    }
  }

  private sign(encodedPayload: string) {
    return createHmac("sha256", this.getSigningSecret()).update(encodedPayload).digest("base64url");
  }

  private getSigningSecret() {
    return process.env.TOKEN_ENCRYPTION_KEY?.trim() || "ai-vidio-admin-session-secret";
  }

  private toBase64Url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
  }
}
