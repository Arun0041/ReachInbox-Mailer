# Outbox Mailer — Frontend

React + TypeScript + Tailwind CSS dashboard for the ReachInbox email job scheduler
assignment. The UI matches the provided Figma design.

## Screens

| Route | Screen |
| --- | --- |
| `/login` | Login (Google OAuth button + email/password form) |
| `/?tab=scheduled` | Dashboard — Scheduled emails table (orange time pill, Failed pill) |
| `/?tab=sent` | Dashboard — Sent emails table (green Sent pill) |
| `/emails/:id` | Email detail view (sender, highlighted quote block, attachments) |
| `/compose` | Compose New Email (From/To/Subject, Delay between 2 emails, Hourly Limit, rich-text toolbar, Send Later panel, CSV upload) |

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

## Backend wiring

- All API calls go through `src/api/client.ts` (`VITE_API_BASE` overrides the base, default `/api`).
- The Vite dev server proxies `/api` to `http://localhost:4000` (see `vite.config.ts`).
- Until the backend is running, the client falls back to in-memory mock data so every
  screen is fully explorable.

Expected endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/me` | Current logged-in user |
| `POST` | `/api/auth/google` | Start Google OAuth flow |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/emails?status=scheduled\|sent` | List emails |
| `GET` | `/api/emails/counts` | Sidebar counters |
| `GET` | `/api/emails/:id` | Single email |
| `POST` | `/api/emails/schedule` | Schedule emails (subject, body, recipients, start time, delay, hourly limit) |
| `PATCH` | `/api/emails/:id/star` | Toggle star |
| `GET` | `/api/senders` | Available sender identities |

## Structure

```
src/
  api/client.ts        typed API client with mock fallback
  mock/data.ts         seed data mirroring the Figma content
  components/
    ui.tsx             Button, Input, Pill, LetterAvatar, Spinner
    Sidebar.tsx        ONB logo, user card, Compose, Scheduled/Sent nav
    PixelLogo.tsx      pixel-art "ONB" wordmark
    GoogleIcon.tsx     official Google G mark
  pages/
    Login.tsx
    Dashboard.tsx      search + scheduled/sent tables
    EmailDetail.tsx
    Compose.tsx        compose form, Send Later panel, CSV email parsing
  types.ts             shared Email/User/ScheduleRequest types
```

## UX details implemented

- Loading indicators (sidebar counts, tables, detail view)
- Empty states for both tables
- Basic error messages with retry
- CSV/TXT upload parses email addresses and shows how many were detected
- Optimistic star toggle
- Send Later: pick date & time or presets (Tomorrow, 10:00 AM, 11:00 AM, 3:00 PM)
