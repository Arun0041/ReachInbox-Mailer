# Outbox Mailer — ReachInbox Full-stack Email Job Scheduler

A production-style email scheduler service + dashboard: schedule emails via an
API, deliver them at the right time through BullMQ/Redis, and watch everything
from a dashboard that matches the provided Figma design.

```
OutboxMailer/
├── backend/    Express + TypeScript + BullMQ + Postgres + Elasticsearch
├── frontend/   React + TypeScript + Tailwind CSS (Figma-matching UI)
└── docker-compose.yml   Redis, Postgres, Elasticsearch
```

## Free hosting (Vercel + Render + Upstash)

The full stack runs on free tiers: **Vercel** (frontend), **Render** (API +
Postgres), **Upstash** (Redis). Elasticsearch has no practical free host — the
API automatically falls back to SQL search when it is unreachable, so search
still works.

### 1. Upstash Redis (free)

1. upstash.com → Create database → region near Render's (e.g. Frankfurt).
2. Copy the **Redis URL** (`rediss://default:...`). BullMQ works over Upstash's
   TCP endpoint (the queue connections already use
   `maxRetriesPerRequest: null, enableReadyCheck: false`).

### 2. Render (backend + Postgres)

1. Render dashboard → **New → Blueprint** → pick this repo → the `render.yaml`
   blueprint creates the web service + free Postgres.
2. Fill the prompted values:
   - `APP_URL` → `https://<your-service>.onrender.com`
   - `FRONTEND_URL` → your Vercel URL (set after step 3, or edit later)
   - `REDIS_URL` → the Upstash `rediss://...` URL
3. Free-instance note: the service sleeps after ~15 min without traffic, which
   delays queued emails until the next request wakes it. For an always-on
   scheduler on the free plan, ping `https://<service>.onrender.com/api/health`
   every 10 minutes with a free uptime monitor (cron-job.org / UptimeRobot).

### 3. Vercel (frontend)

1. vercel.com → Add New Project → import the repo.
2. **Root Directory: `frontend`** (framework auto-detected as Vite).
3. Environment variables:
   - `VITE_API_BASE` = `https://<your-service>.onrender.com/api`
   - `VITE_USE_MOCKS` = `false`
4. Deploy. `vercel.json` already handles SPA deep links (`/compose`, `/emails/:id`).

### 4. OAuth redirect URIs (hosted URLs)

- Google Cloud Console → add
  `https://<your-service>.onrender.com/api/auth/google/callback`, then set
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Render.
- Slack app → add `https://<your-service>.onrender.com/api/slack/callback`,
  then set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` on Render.

Cross-origin sessions: with `APP_URL` on https, the API sets its session cookie
with `SameSite=None; Secure` (see `backend/src/routes/auth.ts`), which Chrome,
Edge and Firefox accept for the Vercel→Render credential'd requests. Safari's
cross-site cookie blocking can interfere; testing in Chrome is recommended.

## Quick start

```bash
# 1. Infrastructure (Redis, Postgres, Elasticsearch)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # fill in GOOGLE_CLIENT_ID / SECRET (see below)
npm install
npm run dev                 # API on :4000, Bull Board on /admin/queues

# 3. Frontend (new terminal)
cd frontend
npm install
# For the real backend, edit frontend/.env → VITE_USE_MOCKS=false
npm run dev                 # UI on :5173
```

### Google OAuth setup (required for real login)

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web).
2. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`.
3. Put the client id/secret in `backend/.env`.

### Slack OAuth setup (required for "Connect Slack" notifications)

1. api.slack.com/apps → Create App → OAuth & Permissions.
2. Redirect URL: `http://localhost:4000/api/slack/callback`.
3. Bot token scopes: `chat:write`, `incoming-webhook`.
4. Put the client id/secret in `backend/.env`.

> No Slack app yet? The system degrades gracefully: rate-limit hits simply
> don't notify, and everything else works. Connecting later starts
> notifications immediately, without a redeploy.

> UI-only preview without infrastructure: set `VITE_USE_MOCKS=true` in
> `frontend/.env` — the UI then runs on mock data (mock login included).

## What you need to enter (checklist)

1. **Start Docker Desktop**, then `docker compose up -d` (Redis, Postgres, Elasticsearch).
2. **`backend/.env`** — copy from `.env.example`, then fill in:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console,
     redirect URI `http://localhost:4000/api/auth/google/callback` *(required)*
   - `SESSION_SECRET` — any long random string *(required)*
   - `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` — from api.slack.com,
     redirect URL `http://localhost:4000/api/slack/callback`,
     bot scopes `chat:write,incoming-webhook` *(optional — everything works without it)*
   - `ETHEREAL_USER` / `ETHEREAL_PASS` — optional; if empty, a throwaway
     Ethereal account is auto-created at boot (its credentials are printed in
     the backend console — use them at ethereal.email to see delivered emails)
   - `MAX_EMAILS_PER_HOUR_PER_SENDER=3` and `MIN_DELAY_BETWEEN_EMAILS_MS=2000`
     — lower the cap temporarily to see rate limiting + the Slack alert fast
3. **`frontend/.env`** — keep `VITE_USE_MOCKS=false` (real backend mode).
4. `cd backend && npm install && npm run dev` → API on :4000, Bull Board on `/admin/queues`.
5. `cd frontend && npm install && npm run dev` → open http://localhost:5173.

## How to verify every functionality (5-minute walkthrough)

1. **Google login** — click *Login with Google* → consent → dashboard shows
   your name, email and avatar; user-card menu has *Log out*.
2. **Compose** — click *Compose*: type an address in *To* and press **space**
   (it becomes a chip, keep typing the next one), write a subject, use the
   editor (**B / I / U / lists / quote** all work), click *Upload List* with a
   CSV of addresses → "N email addresses detected". Press *Send*.
3. **Scheduled tab** — the email appears with an orange time pill; use *Send
   later* (or the clock icon) to schedule one a few minutes out.
4. **Bull Board** — open `http://localhost:4000/admin/queues`: the job is
   waiting/delayed; flip to completed after it sends.
5. **Sent tab** — after the send time, the email shows the green *Sent* pill;
   click it → detail view with your formatting (quotes render in the amber
   block from the design). The raw email also lands in your Ethereal inbox.
6. **Search** — type in the dashboard search bar (Elasticsearch-backed).
7. **Rate limiting + Slack** — with `MAX_EMAILS_PER_HOUR_PER_SENDER=3` and
   Slack connected, schedule 6+ emails due now: 3 send, the rest defer to the
   next hour (Bull Board shows them delayed) and your Slack channel gets the
   alert message.
8. **Restart persistence** — schedule an email for +5 minutes, stop the
   backend (Ctrl+C), start it again: the reconcile log re-ensures the job and
   the email still sends at the right time, exactly once.


## Architecture

```
                 ┌──────────────┐        ┌─────────────────────────────┐
  React UI  ───► │  Express API │ ─────► │ Postgres (emails, users,    │
  (5173)         │  (:4000)     │        │ senders, slack_tokens)      │
                 └──────┬───────┘        └─────────────────────────────┘
                        │ enqueue (delay = scheduled_at − now,
                        │         deterministic jobId: email-<id>)
                        ▼
                 ┌──────────────┐
                 │  BullMQ      │◄── Redis (queue + rate-limit counters)
                 │  Worker      │     min-delay limiter (max 1 / N ms)
                 │  concurrency │
                 └──────┬───────┘
                        │ SMTP (Ethereal Email)
                        ▼
                 sent → Postgres + Elasticsearch index
                        rate-limit hit → Slack message + job deferred
```

### How scheduling works

1. `POST /api/emails/schedule` validates the request and inserts one DB row per
   recipient with `status='scheduled'` and the requested `scheduled_at`.
2. Each row is enqueued into BullMQ with `delay = scheduled_at − now` and a
   deterministic job id `email-<id>`. **No cron anywhere** — BullMQ delayed
   jobs do all timing.
3. Workers pick up due jobs (concurrency `WORKER_CONCURRENCY`), apply the
   queue-level min-delay limiter (`MAX 1 send per
   MIN_DELAY_BETWEEN_EMAILS_MS` — mimics provider throttling), and send via
   Ethereal SMTP.

### Persistence on restart (idempotency)

- Postgres is the source of truth; the DB row records every email's state.
- On boot, `reconcileOnBoot()` re-ensures a queue job for every row still
  marked `scheduled`. Because job ids are deterministic:
  - a missing job (Redis flushed, crash before enqueue) is re-added,
  - an existing delayed/waiting job is left untouched (no duplicates),
  - a stale completed/failed job with a pending DB row is replaced.
- The worker skips (never re-sends) any email whose row is not `scheduled`, and
  the final `UPDATE ... WHERE status='scheduled'` guard makes retries safe.

### Rate limiting & concurrency

- **Worker concurrency:** `WORKER_CONCURRENCY` (default 5); parallel jobs only
  touch distinct rows, guarded by the status check above.
- **Min delay between emails:** BullMQ queue limiter — max 1 job started per
  `MIN_DELAY_BETWEEN_EMAILS_MS` (default 2s).
- **Emails per hour:** per-sender cap `MAX_EMAILS_PER_HOUR_PER_SENDER`
  (default 200), enforced with Redis counters keyed
  `ratelimit:{sender}:{UTC hour window}` — safe across workers/instances (never
  in-memory only). A batch may tighten the cap via its `hourlyLimit` field but
  can never raise it.
- **When the cap is hit:** the job is **deferred to the next hour window**
  (`job.moveToDelayed`), never dropped or failed. Original scheduled-time
  priority is preserved so ordering survives as much as possible, and a live
  Slack notification is sent to the connected workspace.

### Search (Elasticsearch)

Sent and scheduled emails are indexed in Elasticsearch on state change.
`GET /api/emails?q=...` uses a multi_match query (subject, body, recipients,
fuzzy); if Elasticsearch is unreachable the API automatically falls back to
SQL `ILIKE` search so the dashboard never breaks.

### Live queue visibility

Bull Board is mounted at `http://localhost:4000/admin/queues` — waiting,
delayed, active, completed and failed jobs, live.

## API surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/auth/google` | – | Start Google OAuth (real, no mock) |
| GET | `/api/auth/google/callback` | – | OAuth callback, sets session cookie |
| POST | `/api/auth/register` | – | Sign up with email + password (bcrypt-hashed) |
| POST | `/api/auth/login` | – | Log in with email + password |
| GET | `/api/auth/me` | ✓ | Current user + Slack connection status |
| POST | `/api/auth/logout` | ✓ | Clear session |
| GET | `/api/emails?status=&q=` | ✓ | List/search (Elasticsearch, SQL fallback) |
| GET | `/api/emails/counts` | ✓ | Sidebar counters |
| POST | `/api/emails/schedule` | ✓ | Schedule emails (recipients, subject, body, start time, delay, hourly limit) |
| GET | `/api/emails/:id` | ✓ | Single email |
| PATCH | `/api/emails/:id/star` | ✓ | Toggle star |
| GET | `/api/senders` | ✓ | Sender identities for Compose |
| GET | `/api/slack/connect` | ✓ | Start Slack OAuth |
| GET | `/api/slack/callback` | – | Slack OAuth callback |
| GET | `/api/slack/status` | ✓ | Connected? |
| POST | `/api/slack/test` | ✓ | Post a live test message to the connected workspace |
| POST | `/api/slack/disconnect` | ✓ | Remove integration |
| GET | `/admin/queues` | – | Bull Board dashboard |

## Features ↔ requirements map

**Backend**
- Scheduler, persistence, restart-safe reconciliation, idempotency → `backend/src/queue/*`
- Rate limiting & concurrency → `backend/src/services/rateLimiter.ts`, worker limiter
- Multiple senders → `senders` table, Compose "From" dropdown
- Elasticsearch indexing/search → `backend/src/services/elastic.ts`
- Slack OAuth + rate-limit notification → `backend/src/services/slack.ts`
- Bull Board → `backend/src/app.ts`

**Frontend**
- Google login, top-bar user info (name/email/avatar), logout → `Login.tsx`, `Sidebar.tsx`
- Dashboard with Scheduled/Sent tabs, loading/empty/error states → `Dashboard.tsx`
- Slack: dashboard "Connect Slack" callout + sidebar connected state with live
  test-message and disconnect actions → `SlackBanner.tsx`, `Sidebar.tsx`
- Compose: subject, body, CSV upload with detected-address count, start time
  (Send Later), delay between emails, hourly limit → `Compose.tsx`
- Reusable components, typed API responses → `components/ui.tsx`, `types.ts`

## Behaviour under load (design notes)

- **1000+ emails due at once:** enqueueing is O(1) per email; the min-delay
  limiter paces actual sends; the hourly cap spills overflow into subsequent
  hour windows with priority-preserving deferral. Nothing is dropped.
- **Rate limit exceeded:** jobs defer (see above) and Slack gets notified;
  order is kept via scheduled-time priority.
- **Server restart:** future emails still fire on time (reconciliation),
  nothing re-sends (idempotent job ids + status guard).

## Assumptions / trade-offs

- Ethereal is a *fake* SMTP: any "From" address is accepted by its relay, so
  multiple sender identities work against one test account.
- The email/password fields on the login screen are part of the Figma design;
  authentication itself is Google OAuth only (per the assignment).
- Elasticsearch is optional infrastructure — the API falls back to SQL search,
  so the app is fully usable without it.
