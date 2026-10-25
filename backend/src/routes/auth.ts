import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import {
  SESSION_COOKIE,
  requireAuth,
  signSession,
  verifySession,
} from "../middleware/auth.js";

const router = Router();
const googleClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  `${config.appUrl}/api/auth/google/callback`,
);

// Cross-origin hosting (frontend on Vercel, API on Render) needs
// SameSite=None + Secure; local http dev keeps Lax.
function sessionCookieOptions() {
  const secure = config.appUrl.startsWith("https://");
  return {
    httpOnly: true,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: 7 * 24 * 3600 * 1000,
  };
}

function setSessionCookie(res: Response, user: { id: number; email: string; name: string | null; avatar_url: string | null }) {
  const token = signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists — log in instead" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const rows = await query<{ id: number; email: string; name: string | null; avatar_url: string | null }>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url`,
      [email.toLowerCase(), name?.trim() || email.split("@")[0], passwordHash],
    );
    setSessionCookie(res, rows[0]);
    res.status(201).json({ id: rows[0].id, email: rows[0].email, name: rows[0].name });
  } catch (err) {
    console.error("[auth] register failed:", (err as Error).message);
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const rows = await query<{
      id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
      password_hash: string | null;
    }>(`SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = $1`, [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    setSessionCookie(res, user);
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error("[auth] login failed:", (err as Error).message);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/google", (_req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Missing code");

    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token ?? "",
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).send("No email in Google profile");

    const { sub, email, name, picture } = payload;
    const rows = await query<{ id: number; email: string; name: string | null; avatar_url: string | null }>(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
         SET email = $2, name = $3, avatar_url = $4
       RETURNING id, email, name, avatar_url`,
      [sub, email, name ?? null, picture ?? null],
    );
    const user = rows[0];

    const token = signSession({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error("[auth] google callback failed:", (err as Error).message);
    res.status(500).send("Google login failed");
  }
});

router.get("/me", async (req, res) => {
  const session = verifySession((req.cookies?.[SESSION_COOKIE] as string) ?? "");
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  // Slack connection status is part of "me" so the UI renders it in one shot.
  const slack = await query<{ user_id: number }>(
    `SELECT user_id FROM slack_integrations WHERE user_id = $1`,
    [session.id],
  );
  res.json({
    id: session.id,
    name: session.name,
    email: session.email,
    avatarUrl: session.avatar_url,
    slackConnected: slack.length > 0,
  });
});

router.post("/logout", requireAuth, (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

export default router;
