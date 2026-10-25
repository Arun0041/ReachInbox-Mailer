import { Worker, DelayedError, type Job } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";
import { pool, query, type EmailRow } from "../db/pool.js";
import { sendEmail } from "../services/mailer.js";
import { checkRateLimit, effectiveLimit } from "../services/rateLimiter.js";
import { indexEmail } from "../services/elastic.js";
import { notifyRateLimitHit } from "../services/slack.js";
import { EMAIL_QUEUE } from "./queue.js";

// Dedicated blocking connection for the worker (maxRetriesPerRequest: null required).
const workerConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const redis = new Redis(config.redisUrl);

export const emailWorker = new Worker(
  EMAIL_QUEUE,
  async (job: Job<{ emailId: number }>): Promise<void> => {
    const { emailId } = job.data;

    const rows = await query<EmailRow>(
      `SELECT * FROM emails WHERE id = $1`,
      [emailId],
    );
    const email = rows[0];
    if (!email) {
      console.warn(`[worker] email ${emailId} not found, skipping`);
      return;
    }

    // Idempotency: the row is the source of truth. If anything else (a retry,
    // a duplicated job, a restart race) already sent it, do nothing.
    if (email.status !== "scheduled") {
      console.log(`[worker] email ${emailId} already ${email.status}, skipping`);
      return;
    }

    // Per-sender hourly rate limit, backed by Redis so it is safe across
    // workers and instances. When the cap is hit the job is deferred to the
    // start of the next hour window (never dropped, never failed), keeping
    // its original scheduled-time priority so order is preserved.
    const limit = effectiveLimit(config.maxEmailsPerHourPerSender, email);
    const decision = await checkRateLimit(redis, email.from_email, limit);
    if (!decision.allowed) {
      await notifyRateLimitHit(email.user_id, email.from_email, limit);
      console.log(
        `[worker] hourly limit reached for ${email.from_email} — deferring email ${emailId} by ${Math.round(decision.retryAfterMs / 1000)}s`,
      );
      await job.moveToDelayed(Date.now() + decision.retryAfterMs, job.token ?? undefined);
      throw new DelayedError();
    }

    const result = await sendEmail({
      from: email.from_email,
      to: email.to_email,
      subject: email.subject,
      html: email.body,
    });

    await query(
      `UPDATE emails SET status = 'sent', sent_at = now(), error = NULL WHERE id = $1 AND status = 'scheduled'`,
      [emailId],
    );
    await indexEmail({ ...email, status: "sent", sent_at: new Date() });
    console.log(
      `[worker] sent email ${emailId} to ${email.to_email} (${result.messageId})${result.previewUrl ? ` preview: ${result.previewUrl}` : ""}`,
    );
  },
  {
    connection: workerConnection,
    concurrency: config.workerConcurrency,
    // Provider throttling: never start two sends closer together than the
    // configured minimum delay.
    limiter: {
      max: 1,
      duration: config.minDelayBetweenEmailsMs,
    },
  },
);

emailWorker.on("failed", async (job, err) => {
  if (!job || err.name === "DelayedError") return;
  // Exhausted retries → mark failed in the DB (and index it).
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const emailId = job.data.emailId;
    await query(
      `UPDATE emails SET status = 'failed', error = $2 WHERE id = $1 AND status = 'scheduled'`,
      [emailId, err.message.slice(0, 500)],
    );
    try {
      const rows = await query<EmailRow>(`SELECT * FROM emails WHERE id = $1`, [emailId]);
      if (rows[0]) await indexEmail(rows[0]);
    } catch {
      /* ES down — non-fatal */
    }
  }
});

export async function closeWorker(): Promise<void> {
  await emailWorker.close();
  redis.disconnect();
  workerConnection.disconnect();
  await pool.end();
}
