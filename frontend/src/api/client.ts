import type { DashboardCounts, Email, ScheduleRequest, User } from "../types";
import { mockCounts, mockEmails, mockSenders, mockUser } from "../mock/data";

/**
 * API client for the backend (see ../backend).
 *
 * When VITE_USE_MOCKS=true the client falls back to in-memory mock data so the
 * UI is explorable without any infrastructure. Leave it unset/false in real
 * deployments — errors then surface in the UI's error states, and unauthenticated
 * users are redirected to /login.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

let mockStore: Email[] = [...mockEmails];

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...init,
    });
  } catch {
    throw new Error(
      "Cannot reach the server — start the backend (see README: docker compose up -d, then npm run dev in backend/)",
    );
  }
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function withMockFallback<T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  if (USE_MOCKS) {
    try {
      return await real();
    } catch {
      return mock();
    }
  }
  return real();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  mocksEnabled: USE_MOCKS,

  async getCurrentUser(): Promise<User> {
    return withMockFallback(
      () => request<User>("/auth/me"),
      async () => {
        await delay(200);
        return mockUser;
      },
    );
  },

  async listEmails(status: "scheduled" | "sent"): Promise<Email[]> {
    return withMockFallback(
      () => request<Email[]>(`/emails?status=${status}`),
      async () => {
        await delay(300);
        return mockStore.filter((e) =>
          status === "scheduled"
            ? e.status === "scheduled" || e.status === "failed"
            : e.status === "sent",
        );
      },
    );
  },

  /** Server-side (Elasticsearch) search. */
  async searchEmails(query: string, status: "scheduled" | "sent"): Promise<Email[]> {
    return withMockFallback(
      () =>
        request<Email[]>(
          `/emails?status=${status}&q=${encodeURIComponent(query)}`,
        ),
      async () => {
        await delay(150);
        const q = query.toLowerCase();
        return mockStore.filter(
          (e) =>
            (status === "scheduled"
              ? e.status !== "sent"
              : e.status === "sent") &&
            (e.toName.toLowerCase().includes(q) ||
              e.subject.toLowerCase().includes(q)),
        );
      },
    );
  },

  async getCounts(): Promise<DashboardCounts> {
    return withMockFallback(
      () => request<DashboardCounts>("/emails/counts"),
      async () => {
        await delay(200);
        return mockCounts;
      },
    );
  },

  async getEmail(id: string): Promise<Email> {
    return withMockFallback(
      () => request<Email>(`/emails/${id}`),
      async () => {
        await delay(250);
        const found = mockStore.find((e) => e.id === id);
        if (!found) throw new Error("Email not found");
        return found;
      },
    );
  },

  async schedule(payload: ScheduleRequest): Promise<{ ids: number[] }> {
    return withMockFallback(
      () => request<{ ids: number[] }>("/emails/schedule", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      async () => {
        await delay(400);
        const ids = payload.recipients.map((_, i) => Date.now() + i);
        mockStore = [
          ...payload.recipients.map((to, i) => ({
            id: String(ids[i]),
            toName: to.split("@")[0],
            toEmail: to,
            fromEmail: payload.from,
            subject: payload.subject,
            preview: payload.body.slice(0, 80),
            body: payload.body,
            status: "scheduled" as const,
            time: payload.startTime ?? new Date().toISOString(),
          })),
          ...mockStore,
        ];
        return { ids };
      },
    );
  },

  async toggleStar(id: string, starred: boolean): Promise<void> {
    return withMockFallback(
      async () => {
        await request(`/emails/${id}/star`, {
          method: "PATCH",
          body: JSON.stringify({ starred }),
        });
      },
      async () => {
        const found = mockStore.find((e) => e.id === id);
        if (found) found.starred = starred;
      },
    );
  },

  async listSenders(): Promise<string[]> {
    return withMockFallback(
      () => request<string[]>("/senders"),
      async () => mockSenders,
    );
  },

  async logout(): Promise<void> {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      /* clearing the session client-side regardless */
    }
  },

  async register(name: string, email: string, password: string): Promise<void> {
    return withMockFallback(
      async () => {
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
      },
      async () => {
        await delay(400);
      },
    );
  },

  async login(email: string, password: string): Promise<void> {
    return withMockFallback(
      async () => {
        await request("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      },
      async () => {
        await delay(400);
      },
    );
  },

  async getSlackStatus(): Promise<{ connected: boolean }> {
    return withMockFallback(
      () => request<{ connected: boolean }>("/slack/status"),
      async () => ({ connected: false }),
    );
  },

  async sendTestSlackMessage(): Promise<void> {
    return withMockFallback(
      async () => {
        await request("/slack/test", { method: "POST" });
      },
      async () => {
        await delay(500);
      },
    );
  },

  async disconnectSlack(): Promise<void> {
    return withMockFallback(
      async () => {
        await request("/slack/disconnect", { method: "POST" });
      },
      async () => undefined,
    );
  },

  /** Full-page redirect to the Slack OAuth authorize screen. */
  connectSlack(): void {
    window.location.href = `${API_BASE}/slack/connect`;
  },
};
