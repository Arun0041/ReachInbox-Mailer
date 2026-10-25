import { Link2, X } from "lucide-react";

export function SlackBanner({
  error,
  onConnect,
  onDismiss,
}: {
  error?: boolean;
  onConnect: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={
        error
          ? "mb-4 flex h-12 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4"
          : "mb-4 flex h-12 items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft px-4"
      }
    >
      <Link2 className={error ? "h-4 w-4 text-red-500" : "h-4 w-4 text-brand"} />
      <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
        {error
          ? "Slack connection failed — please try connecting again."
          : "Connect Slack to get a live message the moment a sender hits its hourly email limit."}
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="h-8 shrink-0 cursor-pointer rounded-full border border-brand bg-white px-4 text-sm font-medium text-brand transition hover:bg-white/70"
      >
        Connect Slack
      </button>
      <button
        type="button"
        title="Dismiss"
        onClick={onDismiss}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/60"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
