import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import emailRoutes from "./routes/emails.js";
import senderRoutes from "./routes/senders.js";
import slackRoutes from "./routes/slack.js";
import { emailQueue } from "./queue/queue.js";

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/emails", emailRoutes);
  app.use("/api/senders", senderRoutes);
  app.use("/api/slack", slackRoutes);

  // Live BullMQ dashboard for real-time queue visibility.
  const boardAdapter = new ExpressAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: boardAdapter,
  });
  app.use("/admin/queues", boardAdapter.getRouter());

  return app;
}
