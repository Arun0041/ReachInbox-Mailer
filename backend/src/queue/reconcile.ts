import { query } from "../db/pool.js";
import { emailQueue, enqueueEmail } from "./queue.js";

/**
 * Restart persistence / reconciliation.
 *
 * The DB is the source of truth. On boot, every email still marked
 * 'scheduled' gets its BullMQ job re-ensured. Job ids are deterministic
 * (`email-<id>`), so:
 *   - job missing (Redis flushed / crashed before enqueue) → re-added
 *   - job already waiting/delayed → left untouched (no duplicates)
 *   - job completed/failed but DB says scheduled → stale artifact,
 *     removed and re-added so the email is actually delivered.
 */
export async function reconcileOnBoot(): Promise<{ requeued: number; ensured: number }> {
  const rows = await query<{ id: number; scheduled_at: Date }>(
    `SELECT id, scheduled_at FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`,
  );

  let requeued = 0;
  let ensured = 0;

  for (const row of rows) {
    const jobId = `email-${row.id}`;
    const job = await emailQueue.getJob(jobId);
    if (!job) {
      await enqueueEmail(row.id, new Date(row.scheduled_at));
      requeued += 1;
      continue;
    }
    const state = await job.getState();
    if (state === "completed" || state === "failed") {
      await job.remove();
      await enqueueEmail(row.id, new Date(row.scheduled_at));
      requeued += 1;
    } else {
      ensured += 1;
    }
  }

  console.log(
    `[reconcile] ${rows.length} scheduled email(s) checked: ${ensured} already queued, ${requeued} re-queued`,
  );
  return { requeued, ensured };
}
