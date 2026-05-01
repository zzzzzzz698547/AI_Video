import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.TOKEN_ENCRYPTION_KEY ?? "ai-vidio-development-token-key";
    this.key = createHash("sha256").update(rawKey).digest();
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
  }

  decrypt(payload: string) {
    const [ivBase64, tagBase64, dataBase64] = payload.split(".");
    if (!ivBase64 || !tagBase64 || !dataBase64) {
      throw new Error("Invalid encrypted token payload");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataBase64, "base64")),
      decipher.final()
    ]);
    return decrypted.toString("utf8");
  }
}
