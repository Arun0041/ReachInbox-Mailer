import { query } from "../db/pool.js";
import { config } from "../config.js";

/**
 * Slack integration. A user connects their workspace via real OAuth from the
 * dashboard; the bot token / webhook is stored per user. When a sender's
 * hourly limit is hit we post a live message — no log lines.
 */

const REDIRECT_URI = `${config.appUrl}/api/slack/callback`;
const SCOPES = "chat:write,incoming-webhook";

export function slackAuthorizeUrl(): string {
  if (!config.slackClientId) {
    throw new Error("SLACK_CLIENT_ID is not configured");
  }
  const params = new URLSearchParams({
    client_id: config.slackClientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state: "connect",
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface SlackCredentials {
  botToken: string;
  teamId: string;
  channelId: string | null;
  webhookUrl: string | null;
}

export async function exchangeCode(code: string): Promise<SlackCredentials> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.slackClientId,
      client_secret: config.slackClientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    team?: { id: string };
    access_token?: string;
    incoming_webhook?: { url?: string; channel_id?: string };
  };
  if (!data.ok || !data.access_token) {
    throw new Error(`Slack OAuth failed: ${data.error ?? "unknown"}`);
  }
  return {
    botToken: data.access_token,
    teamId: data.team?.id ?? "",
    channelId: data.incoming_webhook?.channel_id ?? null,
    webhookUrl: data.incoming_webhook?.url ?? null,
  };
}

export async function saveIntegration(
  userId: number,
  creds: SlackCredentials,
): Promise<void> {
  await query(
    `INSERT INTO slack_integrations (user_id, team_id, channel_id, bot_token, webhook_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET team_id = $2, channel_id = $3, bot_token = $4, webhook_url = $5,
           connected_at = now()`,
    [userId, creds.teamId, creds.channelId, creds.botToken, creds.webhookUrl],
  );
}

export async function getIntegration(
  userId: number,
): Promise<{ bot_token: string; webhook_url: string | null } | null> {
  const rows = await query<{ bot_token: string; webhook_url: string | null }>(
    `SELECT bot_token, webhook_url FROM slack_integrations WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function disconnect(userId: number): Promise<void> {
  await query(`DELETE FROM slack_integrations WHERE user_id = $1`, [userId]);
}

/**
 * Post a message to the user's connected Slack workspace — live webhook/API
 * call, never a log line. Used for rate-limit alerts and the test message.
 */
export async function sendSlackMessage(userId: number, text: string): Promise<void> {
  const integration = await getIntegration(userId);
  if (!integration) throw new Error("Slack is not connected");

  try {
    if (integration.webhook_url) {
      const res = await fetch(integration.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    } else {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.bot_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
    }
  } catch (err) {
    console.warn("[slack] send failed:", (err as Error).message);
    throw err;
  }
}

/**
 * Live Slack notification when a sender's hourly limit is reached. Works
 * without redeploy once the user connects (and silently does nothing when no
 * user has connected).
 */
export async function notifyRateLimitHit(
  userId: number | null,
  sender: string,
  limit: number,
): Promise<void> {
  if (userId == null) return;
  const integration = await getIntegration(userId);
  if (!integration) return;

  const text = `:warning: *Email rate limit reached*\nSender \`${sender}\` hit its hourly cap of ${limit} emails/hour. Queued emails are being deferred to the next hour window.`;
  await sendSlackMessage(userId, text);
}
