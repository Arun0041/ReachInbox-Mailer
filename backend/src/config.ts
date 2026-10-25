import "dotenv/config";

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  port: num("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  appUrl: process.env.APP_URL ?? "http://localhost:4000",

  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://outbox:outbox@localhost:5432/outbox",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Worker behaviour (all configurable — no hardcoding)
  workerConcurrency: num("WORKER_CONCURRENCY", 5),
  /** Minimum gap between two email sends, in milliseconds */
  minDelayBetweenEmailsMs: num("MIN_DELAY_BETWEEN_EMAILS_MS", 2000),
  /** Per-sender cap on emails sent per rolling hour window */
  maxEmailsPerHourPerSender: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 200),

  // Ethereal Email — when omitted, a throwaway test account is created at boot
  etherealUser: process.env.ETHEREAL_USER,
  etherealPass: process.env.ETHEREAL_PASS,

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-change-me",

  slackClientId: process.env.SLACK_CLIENT_ID ?? "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? "",

  elasticNode: process.env.ELASTIC_NODE ?? "http://localhost:9200",

  defaultSenders: (
    process.env.DEFAULT_SENDERS ?? "oliver.brown@domain.io,grant@domain.io"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;
