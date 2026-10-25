import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  disconnect,
  exchangeCode,
  getIntegration,
  saveIntegration,
  sendSlackMessage,
  slackAuthorizeUrl,
} from "../services/slack.js";

const router = Router();
router.use(requireAuth);

router.get("/connect", (_req, res) => {
  if (!config.slackClientId) {
    return res.status(500).send("Slack OAuth is not configured (SLACK_CLIENT_ID missing)");
  }
  res.redirect(slackAuthorizeUrl());
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send("Missing code");
    const creds = await exchangeCode(code);
    await saveIntegration(req.user!.id, creds);
    res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (err) {
    console.error("[slack] callback failed:", (err as Error).message);
    res.redirect(`${config.frontendUrl}/?slack=error`);
  }
});

router.get("/status", async (req, res) => {
  const integration = await getIntegration(req.user!.id);
  res.json({ connected: Boolean(integration) });
});

router.post("/test", async (req, res) => {
  try {
    await sendSlackMessage(
      req.user!.id,
      ":white_check_mark: *Outbox Mailer* is connected to this workspace. You'll get a message here the moment a sender hits its hourly email limit.",
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.post("/disconnect", async (req, res) => {
  await disconnect(req.user!.id);
  res.json({ ok: true });
});

export default router;
