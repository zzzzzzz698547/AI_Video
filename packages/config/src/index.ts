export type AppEnvironment = "dev" | "staging" | "production";

export type AppConfig = {
  appEnv: AppEnvironment;
  apiUrl: string;
  adminUrl: string;
  databaseUrl: string;
  redisUrl: string;
  tokenEncryptionKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appEnv = (env.APP_ENV as AppEnvironment | undefined) ?? "dev";
  return {
    appEnv,
    apiUrl: env.API_URL ?? "http://localhost:3001",
    adminUrl: env.ADMIN_URL ?? "http://localhost:3000",
    databaseUrl: env.DATABASE_URL ?? "",
    redisUrl: env.REDIS_URL ?? "",
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY ?? ""
  };
}

