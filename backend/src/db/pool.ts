import { Pool } from "pg";
import { config } from "../config.js";

export const pool = new Pool({ connectionString: config.databaseUrl });

export interface EmailRow {
  id: number;
  user_id: number | null;
  from_email: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  status: "scheduled" | "sent" | "failed";
  scheduled_at: Date;
  sent_at: Date | null;
  error: string | null;
  starred: boolean;
  hourly_limit: number | null;
  batch_id: string;
}

export interface UserRow {
  id: number;
  google_id: string | null;
  email: string;
  name: string | null;
  avatar_url: string | null;
  password_hash?: string | null;
}

export async function query<T>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function initSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS senders (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT
    );

    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      to_name TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'sent', 'failed')),
      scheduled_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      error TEXT,
      starred BOOLEAN NOT NULL DEFAULT false,
      hourly_limit INTEGER,
      batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS emails_status_idx ON emails (status, scheduled_at);
    CREATE INDEX IF NOT EXISTS emails_user_idx ON emails (user_id);

    CREATE TABLE IF NOT EXISTS slack_integrations (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      team_id TEXT,
      channel_id TEXT,
      bot_token TEXT NOT NULL,
      webhook_url TEXT,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);

  for (const sender of config.defaultSenders) {
    await query(
      `INSERT INTO senders (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [sender],
    );
  }
}
