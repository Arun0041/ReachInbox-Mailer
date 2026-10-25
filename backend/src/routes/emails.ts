import { Router } from "express";
import { query, type EmailRow } from "../db/pool.js";
import { enqueueEmail } from "../queue/queue.js";
import { requireAuth } from "../middleware/auth.js";
import { searchEmailIds } from "../services/elastic.js";

const router = Router();
router.use(requireAuth);

const EMAIL_SELECT = `
  SELECT id, from_email, to_email, to_name, subject, body, status,
         scheduled_at, sent_at, error, starred, batch_id
  FROM emails`;

interface ApiEmail {
  id: string;
  toName: string;
  toEmail: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  preview: string;
  body: string;
  status: "scheduled" | "sent" | "failed";
  time: string;
  error: string | null;
  starred: boolean;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toApi(row: EmailRow): ApiEmail {
  return {
    id: String(row.id),
    toName: row.to_name ?? row.to_email,
    toEmail: row.to_email,
    fromEmail: row.from_email,
    fromName: null,
    subject: row.subject,
    preview: stripTags(row.body).slice(0, 90),
    body: row.body,
    status: row.status,
    time: (row.status === "sent" ? (row.sent_at ?? row.scheduled_at) : row.scheduled_at).toISOString(),
    error: row.error,
    starred: row.starred,
  };
}

router.get("/", async (req, res) => {
  const status = req.query.status === "sent" ? "sent" : req.query.status === "scheduled" ? "scheduled" : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  let ids: number[] | null = null;
  if (q) {
    // Prefer Elasticsearch; silently fall back to SQL ILIKE when it is down.
    ids = await searchEmailIds(q, status);
  }

  let rows: EmailRow[];
  if (ids) {
    if (ids.length === 0) return res.json([]);
    rows = await query<EmailRow>(
      `${EMAIL_SELECT} WHERE id = ANY($1::int[]) ${status ? "AND status = $2" : ""}
       ORDER BY scheduled_at DESC`,
      status ? [ids, status] : [ids],
    );
  } else {
    rows = await query<EmailRow>(
      `${EMAIL_SELECT} WHERE ($1::text IS NULL OR status = $1)
       AND ($2::text IS NULL OR subject ILIKE '%' || $2 || '%' OR to_email ILIKE '%' || $2 || '%' OR to_name ILIKE '%' || $2 || '%' OR body ILIKE '%' || $2 || '%')
       ORDER BY scheduled_at DESC LIMIT 500`,
      [status ?? null, q || null],
    );
  }
  res.json(rows.map(toApi));
});

router.get("/counts", async (_req, res) => {
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM emails GROUP BY status`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  res.json({ scheduled: map.scheduled ?? 0, sent: map.sent ?? 0 });
});

// Schedule one email per recipient (a batch shares a batch_id)
router.post("/schedule", async (req, res) => {
  const { from, recipients, subject, body, startTime, delaySeconds, hourlyLimit } =
    req.body as {
      from?: string;
      recipients?: string[];
      subject?: string;
      body?: string;
      startTime?: string | null;
      delaySeconds?: number;
      hourlyLimit?: number;
    };

  const errors: string[] = [];
  if (!from || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) errors.push("Invalid sender address");
  if (!Array.isArray(recipients) || recipients.length === 0) errors.push("At least one recipient is required");
  for (const r of recipients ?? []) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r)) errors.push(`Invalid recipient: ${r}`);
  }
  if (!subject?.trim()) errors.push("Subject is required");
  if (!body?.trim()) errors.push("Body is required");
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const base = startTime ? new Date(startTime) : new Date();
  if (Number.isNaN(base.getTime())) {
    return res.status(400).json({ error: "Invalid start time" });
  }
  const spacing = Math.max(0, Number(delaySeconds) || 0) * 1000;

  const created: { id: number }[] = [];
  for (const [i, to] of (recipients ?? []).entries()) {
    const scheduledAt = new Date(base.getTime() + i * spacing);
    const rows = await query<{ id: number }>(
      `INSERT INTO emails (from_email, to_email, to_name, subject, body, status, scheduled_at, hourly_limit)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7) RETURNING id`,
      [from, to, to.split("@")[0], subject, body, scheduledAt, hourlyLimit ?? null],
    );
    await enqueueEmail(rows[0].id, scheduledAt);
    created.push(rows[0]);
  }

  res.status(201).json({ ids: created.map((c) => c.id) });
});

router.get("/:id", async (req, res) => {
  const rows = await query<EmailRow>(`${EMAIL_SELECT} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Email not found" });
  res.json(toApi(rows[0]));
});

router.patch("/:id/star", async (req, res) => {
  const starred = Boolean(req.body?.starred);
  await query(`UPDATE emails SET starred = $2 WHERE id = $1`, [req.params.id, starred]);
  res.json({ ok: true });
});

export default router;
