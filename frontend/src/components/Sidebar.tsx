import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BellRing,
  ChevronDown,
  CircleDashed,
  Clock,
  Link2,
  LogOut,
  Send,
  Unlink,
} from "lucide-react";
import { PixelLogo } from "./PixelLogo";
import { cx } from "./ui";
import type { DashboardCounts, User } from "../types";

interface SidebarProps {
  user: User;
  counts: DashboardCounts;
  slackConnected: boolean;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void | Promise<void>;
  onTestSlack: () => Promise<void>;
  onLogout: () => void | Promise<void>;
}

export function Sidebar({
  user,
  counts,
  slackConnected,
  onConnectSlack,
  onDisconnectSlack,
  onTestSlack,
  onLogout,
}: SidebarProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get("tab") === "sent" ? "sent" : "scheduled";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-gray-100 bg-white px-4 pb-4">
      <div className="px-1 pb-5 pt-6">
        <PixelLogo text="ONB" size={5} />
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50"
        >
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-9 w-9 rounded-full bg-gray-100 object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-gray-900">
              {user.name}
            </span>
            <span className="block truncate text-xs text-gray-400">{user.email}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
            <div className="px-4 py-2">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-400">{user.email}</p>
            </div>
            <div className="h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                void onLogout();
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("/compose")}
        className="mt-3 h-10 w-full cursor-pointer rounded-full border border-brand bg-white text-sm font-medium text-brand transition hover:bg-brand-soft"
      >
        Compose
      </button>

      <p className="mt-8 px-2 text-[11px] font-medium tracking-wider text-gray-300 uppercase">
        Core
      </p>

      <nav className="mt-2 space-y-1">
        <button
          type="button"
          onClick={() => navigate("/?tab=scheduled")}
          className={cx(
            "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition",
            tab === "scheduled"
              ? "bg-brand-soft font-semibold text-gray-900"
              : "text-gray-700 hover:bg-gray-50",
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-gray-700" />
          <span className="flex-1 text-left">Scheduled</span>
          <span className={cx("text-xs", tab === "scheduled" ? "text-gray-600" : "text-gray-400")}>
            {counts.scheduled}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/?tab=sent")}
          className={cx(
            "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition",
            tab === "sent"
              ? "bg-brand-soft font-semibold text-gray-900"
              : "text-gray-700 hover:bg-gray-50",
          )}
        >
          <Send className="h-4 w-4 shrink-0 text-gray-700" />
          <span className="flex-1 text-left">Sent</span>
          <span className={cx("text-xs", tab === "sent" ? "text-gray-600" : "text-gray-400")}>
            {counts.sent}
          </span>
        </button>
      </nav>

      <div className="mt-auto">
        <p className="px-2 text-[11px] font-medium tracking-wider text-gray-300 uppercase">
          Integrations
        </p>
        {slackConnected ? (
          <div className="mt-2">
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-gray-700">
              <span className="flex items-center gap-2.5">
                <CircleDashed className="h-4 w-4 text-brand" />
                Slack connected
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  title="Send test message"
                  onClick={async () => {
                    setTestState("sending");
                    try {
                      await onTestSlack();
                      setTestState("sent");
                    } catch {
                      setTestState("error");
                    }
                    setTimeout(() => setTestState("idle"), 2500);
                  }}
                  className={cx(
                    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition",
                    testState === "error"
                      ? "text-red-500"
                      : testState === "sent"
                        ? "text-brand"
                        : "text-gray-400 hover:text-brand hover:bg-gray-50",
                  )}
                >
                  <BellRing className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Disconnect Slack"
                  onClick={() => void onDisconnectSlack()}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:text-red-500 hover:bg-gray-50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            {testState !== "idle" && testState !== "sending" && (
              <p className={cx("px-2.5 text-xs", testState === "sent" ? "text-brand" : "text-red-500")}>
                {testState === "sent"
                  ? "Test message sent to your Slack channel."
                  : "Could not send the test message."}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectSlack}
            className="mt-2 flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            <Link2 className="h-4 w-4 text-gray-700" />
            <span className="flex-1 text-left">Connect Slack</span>
          </button>
        )}
      </div>
    </aside>
  );
}
