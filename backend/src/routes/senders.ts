import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const rows = await query<{ email: string; display_name: string | null }>(
    `SELECT email, display_name FROM senders ORDER BY email`,
  );
  res.json(rows.map((r) => r.email));
});

export default router;
