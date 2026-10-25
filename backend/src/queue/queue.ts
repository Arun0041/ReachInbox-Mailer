import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

// BullMQ requires maxed-out connections (blocking commands on workers).
// enableReadyCheck:false keeps Upstash (free hosted Redis) happy.
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const EMAIL_QUEUE = "email-send";

export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Enqueue a scheduled email. The BullMQ job id is derived from the email row
 * id, which makes (re-)enqueuing idempotent: adding a job whose id already
 * exists in the queue is a no-op, so a restart can safely reconcile.
 */
export async function enqueueEmail(emailId: number, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    "send",
    { emailId },
    {
      jobId: `email-${emailId}`,
      delay,
    },
  );
}

export { connection };
