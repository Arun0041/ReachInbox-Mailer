import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { api } from "../api/client";
import { LetterAvatar, Spinner } from "../components/ui";
import type { Email } from "../types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Minimal sanitizer for composed HTML bodies (no scripts, no inline handlers). */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "blocked:");
}

/** Renders the body with the amber highlighted-quote block seen in the design. */
function Body({ body }: { body: string }) {
  const isHtml = body.trimStart().startsWith("<");

  if (isHtml) {
    return (
      <div
        className="body-html space-y-4 text-[15px] leading-relaxed text-gray-800 [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:bg-amber-50 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:font-semibold [&_blockquote]:text-gray-900 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
      />
    );
  }

  return (
    <div className="space-y-5 text-[15px] leading-relaxed whitespace-pre-wrap text-gray-800">
      {body.split("\n\n").map((para, i) =>
        para.includes("⚡") ? (
          <blockquote
            key={i}
            className="border-l-4 border-amber-400 bg-amber-50 px-5 py-3 font-semibold text-gray-900"
          >
            {para}
          </blockquote>
        ) : (
          <p key={i}>{para}</p>
        ),
      )}
    </div>
  );
}

export default function EmailDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const backTab = params.get("tab") === "sent" ? "sent" : "scheduled";

  const [email, setEmail] = useState<Email | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    api
      .getEmail(id)
      .then((e) => {
        if (!cancelled) setEmail(e);
      })
      .catch(() => {
        if (!cancelled) setError("Email not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate(`/?tab=${backTab}`)}
          className="cursor-pointer text-sm font-medium text-brand hover:underline"
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-8">
        <button
          type="button"
          onClick={() => navigate(`/?tab=${backTab}`)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-gray-900">
          {email.subject}
        </h1>
        <span className="truncate text-lg font-semibold text-gray-900">
          &nbsp;| {email.id.toUpperCase().replace("EMAIL-", "")}
        </span>
      </div>

      <div className="px-8 py-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <LetterAvatar name={email.fromName ?? email.fromEmail} className="h-10 w-10" />
            <div>
              <p className="text-sm">
                <span className="font-semibold text-gray-900">
                  {email.fromName ?? email.fromEmail}
                </span>{" "}
                <span className="text-gray-500">&lt;{email.fromEmail}&gt;</span>
              </p>
              <button
                type="button"
                className="mt-0.5 flex cursor-pointer items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                to me <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">{formatDateTime(email.time)}</p>
        </div>

        <div className="mt-8 max-w-3xl">
          <Body body={email.body} />
        </div>

        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-4">
            {email.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="block w-44 overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
              >
                <img src={att.url} alt={att.filename} className="h-28 w-full object-cover" />
                <div className="px-3 py-2">
                  <p className="truncate text-xs font-medium text-gray-800">
                    {att.filename}
                  </p>
                  <p className="text-[11px] text-gray-400">{att.size}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
