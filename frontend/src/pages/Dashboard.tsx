import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, RefreshCw, Search, Filter, Star } from "lucide-react";
import { api } from "../api/client";
import { Pill, Spinner, cx } from "../components/ui";
import { SlackBanner } from "../components/SlackBanner";
import type { Email } from "../types";

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface DashboardProps {
  slackConnected: boolean;
  onConnectSlack: () => void;
}

export default function Dashboard({ slackConnected, onConnectSlack }: DashboardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get("tab") === "sent" ? "sent" : "scheduled";
  const slackError = params.get("slack") === "error";
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the search box so typing doesn't hammer the API (the backend
  // search is backed by Elasticsearch when available).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);  useEffect(() => {
    let cancelled = false;
    setEmails(null);
    setError(null);
    const load = debouncedQuery
      ? api.searchEmails(debouncedQuery, tab)
      : api.listEmails(tab);
    load
      .then((list) => {
        if (!cancelled) setEmails(list);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load emails. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [tab, debouncedQuery, reloadKey]);

  const filtered = useMemo(() => emails, [emails]);

  const toggleStar = async (email: Email) => {
    setEmails((prev) =>
      prev
        ? prev.map((e) => (e.id === email.id ? { ...e, starred: !e.starred } : e))
        : prev,
    );
    try {
      await api.toggleStar(email.id, !email.starred);
    } catch {
      /* keep optimistic state */
    }  };

  return (
    <main className="flex min-w-0 flex-1 flex-col px-8 pb-8 pt-6">
      {!slackConnected && !bannerDismissed && (
        <SlackBanner
          error={slackError}
          onConnect={onConnectSlack}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-full bg-gray-100 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <button
          type="button"
          title="Filter"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
        >
          <Filter className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          title="Refresh"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
        >
          <RefreshCw className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="mt-5 flex-1">
        {filtered === null && !error && (
          <div className="flex h-48 items-center justify-center gap-3 text-sm text-gray-400">
            <Spinner /> Loading emails...
          </div>
        )}

        {error && (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="cursor-pointer text-sm font-medium text-brand hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {filtered && filtered.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200">
            <p className="text-sm font-medium text-gray-500">
              {debouncedQuery
                ? `No results for "${debouncedQuery}"`
                : `No ${tab} emails yet`}
            </p>
            <p className="text-xs text-gray-400">
              {debouncedQuery
                ? "Try a different search term."
                : tab === "scheduled"
                  ? "Emails you schedule will show up here."
                  : "Emails that have been sent will show up here."}
            </p>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {filtered.map((email) => (
              <li
                key={email.id}
                className="group flex h-14 cursor-pointer items-center gap-4 px-2 transition hover:bg-gray-50/70"
                onClick={() => navigate(`/emails/${email.id}?tab=${tab}`)}
              >
                <span className="w-48 shrink-0 truncate text-sm font-semibold text-gray-900">
                  To: {email.toName}
                </span>

                <span className="w-44 shrink-0">
                  {email.status === "scheduled" && (
                    <Pill tone="orange" icon={<Clock className="h-3.5 w-3.5" />}>
                      {formatTime(email.time)}
                    </Pill>
                  )}
                  {email.status === "failed" && <Pill tone="red">Failed</Pill>}
                  {email.status === "sent" && <Pill tone="green">Sent</Pill>}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-semibold text-gray-900">{email.subject}</span>{" "}
                  <span className="text-gray-400">- {email.preview}</span>
                </span>

                <button
                  type="button"
                  title={email.starred ? "Unstar" : "Star"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleStar(email);
                  }}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg"
                >
                  <Star
                    className={cx(
                      "h-4 w-4 transition",
                      email.starred
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300 group-hover:text-gray-400",
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
