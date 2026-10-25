import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { api } from "../api/client";
import { Button, cx } from "../components/ui";
import { RichTextEditor } from "../components/RichTextEditor";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return Array.from(new Set(matches ?? []));
}

function tomorrowAt(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function formatLabel(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Compose() {
  const navigate = useNavigate();

  const [senders, setSenders] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [toDraft, setToDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("00");
  const [hourlyLimit, setHourlyLimit] = useState("00");

  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [customTime, setCustomTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listSenders().then((list) => {
      setSenders(list);
      setFrom((cur) => cur || list[0] || "");
    });
  }, []);

  /** Space / comma / Enter commits the typed address as a chip. */
  const commitToDraft = (): boolean => {
    const parts = toDraft
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = parts.filter((p) => EMAIL_REGEX.test(p));
    if (valid.length === 0) return false;
    setRecipients((prev) => Array.from(new Set([...prev, ...valid])));
    setToDraft("");
    return true;
  };

  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!commitToDraft() && toDraft.trim()) {
        setError(`"${toDraft.trim()}" is not a valid email address`);
      } else {
        setError(null);
      }
      return;
    }
    if (e.key === " " || e.key === ",") {
      if (commitToDraft()) {
        e.preventDefault();
        setError(null);
      }
      return;
    }
    if (e.key === "Backspace" && !toDraft && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  };

  const handleUpload = async (file: File) => {
    const text = await file.text();
    const found = extractEmails(text);
    setRecipients((prev) => Array.from(new Set([...prev, ...found])));
    setUploadInfo(
      `${found.length} email address${found.length === 1 ? "" : "es"} detected in ${file.name}`,
    );
  };

  /** Toolbar paperclip / header paperclip insert a file marker into the body. */
  const attachFile = (file: File) => {
    setBody(
      (prev) => `${prev}<p>📎 ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)</p>`,
    );
    setUploadInfo(`Attached ${file.name}`);
  };

  const schedule = async () => {
    setError(null);
    commitToDraft();
    if (recipients.length === 0) return setError("Add at least one recipient.");
    if (!subject.trim()) return setError("Subject is required.");
    if (!body.trim() || body === "<br>") return setError("Email body is required.");

    try {
      await api.schedule({
        from,
        recipients,
        subject,
        body,
        startTime: scheduledAt ? scheduledAt.toISOString() : null,
        delaySeconds: Number.parseInt(delaySeconds, 10) || 0,
        hourlyLimit: Number.parseInt(hourlyLimit, 10) || 0,
      });
      navigate("/?tab=scheduled");
    } catch {
      setError("Could not schedule the email. Please try again.");
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">

      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Compose New Email</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Attach file"
            onClick={() => attachInputRef.current?.click()}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-brand transition hover:bg-brand-soft"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            title="Send later"
            onClick={() => setSendLaterOpen((v) => !v)}
            className={cx(
              "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition",
              sendLaterOpen || scheduledAt
                ? "bg-brand-soft text-brand"
                : "text-gray-500 hover:bg-gray-100",
            )}
          >
            <Clock className="h-4.5 w-4.5" />
          </button>

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => {
                if (scheduledAt) {
                  void schedule();
                } else {
                  setSendMenuOpen((v) => !v);
                }
              }}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-brand bg-white px-4 text-sm font-medium text-brand transition hover:bg-brand-soft"
            >
              {scheduledAt ? `Schedule for ${formatLabel(scheduledAt)}` : "Send"}
              {!scheduledAt && <ChevronDown className="h-4 w-4" />}
            </button>

            {sendMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledAt(null);
                    setSendMenuOpen(false);
                    void schedule();
                  }}
                  className="flex w-full cursor-pointer items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Send now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendMenuOpen(false);
                    setSendLaterOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Send later...
                </button>
              </div>
            )}
          </div>
        </div>
      </div>


      {sendLaterOpen && (
        <div className="relative z-10 flex justify-end px-8">
          <div className="absolute top-2 right-16 w-60 rounded-xl border border-gray-100 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-gray-900">Send Later</p>
            <label className="relative mt-3 flex cursor-pointer items-center justify-between rounded-lg px-1 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50">
              Pick date &amp; time
              <Clock className="h-4 w-4 text-gray-400" />
              <input
                type="datetime-local"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  if (e.target.value) setScheduledAt(new Date(e.target.value));
                }}
                className="absolute inset-x-4 top-11 z-30 h-8 cursor-pointer opacity-0"
              />
            </label>
            <div className="mt-1 space-y-0.5">
              {[
                { label: "Tomorrow", value: tomorrowAt(9) },
                { label: "Tomorrow, 10:00 AM", value: tomorrowAt(10) },
                { label: "Tomorrow, 11:00 AM", value: tomorrowAt(11) },
                { label: "Tomorrow, 3:00 PM", value: tomorrowAt(15) },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setScheduledAt(opt.value);
                    setCustomTime("");
                  }}
                  className={cx(
                    "block w-full cursor-pointer rounded-lg px-1 py-1.5 text-left text-sm transition hover:bg-gray-50",
                    scheduledAt && !customTime && scheduledAt.getTime() === opt.value.getTime()
                      ? "font-medium text-brand"
                      : "text-gray-700",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendLaterOpen(false)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <Button
                variant="outline-green"
                className="h-8 rounded-full px-4"
                onClick={() => setSendLaterOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}


      <div className="flex flex-col px-8 pt-2 pb-8">
        <div className="mx-auto w-full max-w-4xl">

          <div className="flex items-center gap-3 border-b border-gray-100 py-3">
            <label className="w-24 shrink-0 text-sm font-medium text-gray-700">From</label>
            <div className="relative">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white pr-8 pl-3 text-sm text-gray-700 outline-none focus:border-brand"
              >
                {(senders.length ? senders : [from || "oliver.brown@domain.io"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>
          </div>


          <div className="flex items-start gap-3 border-b border-gray-100 py-3">
            <label className="w-24 shrink-0 pt-1.5 text-sm font-medium text-gray-700">
              To
            </label>
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              onClick={() => toInputRef.current?.focus()}
            >
              {recipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-medium text-green-800"
                >
                  {r}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecipients((prev) => prev.filter((x) => x !== r));
                    }}
                    className="cursor-pointer text-green-700 hover:text-green-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {recipients.length > 5 && (
                <span className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500">
                  +{recipients.length - 5} uploaded
                </span>
              )}
              <input
                ref={toInputRef}
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                onKeyDown={handleToKeyDown}
                onBlur={() => commitToDraft()}
                placeholder={recipients.length ? "Add another email..." : "recipient@example.com"}
                className="h-7 min-w-44 flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-sm font-medium text-brand hover:underline"
            >
              <Upload className="h-4 w-4" />
              Upload List
            </button>
          </div>

          {uploadInfo && <p className="mt-1 text-xs text-brand">{uploadInfo}</p>}


          <div className="flex items-center gap-3 border-b border-gray-100 py-3">
            <label className="w-24 shrink-0 text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="h-7 flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
          </div>


          <div className="flex items-center gap-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Delay between 2 emails
              </span>
              <input
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="h-8 w-14 rounded-lg border border-gray-200 px-2 text-center text-sm text-gray-700 outline-none focus:border-brand"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Hourly Limit:</span>
              <input
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="h-8 w-14 rounded-lg border border-gray-200 px-2 text-center text-sm text-gray-700 outline-none focus:border-brand"
              />
            </div>
            {scheduledAt && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-pill-orange px-2.5 py-1 text-xs font-medium text-pill-orange-text">
                <Clock className="h-3.5 w-3.5" />
                Scheduled for {formatLabel(scheduledAt)}
              </span>
            )}
          </div>


          <RichTextEditor
            value={body}
            onChange={setBody}
            onAttach={() => fileInputRef.current?.click()}
          />

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = "";
        }}
      />

      <input
        ref={attachInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) attachFile(file);
          e.target.value = "";
        }}
      />
    </main>
  );
}
