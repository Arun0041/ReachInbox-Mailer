import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { api } from "./api/client";
import type { DashboardCounts, User } from "./types";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EmailDetail from "./pages/EmailDetail";
import Compose from "./pages/Compose";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<"loading" | "authed" | "guest">("loading");
  const [slackConnected, setSlackConnected] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts>({ scheduled: 0, sent: 0 });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getCurrentUser()
      .then((u) => {
        setUser(u);
        setSlackConnected(u.slackConnected ?? false);
        setAuthState("authed");
      })
      .catch(() => setAuthState("guest"));
  }, []);

  // Slack OAuth lands back on the dashboard with ?slack=connected|error
  useEffect(() => {
    if (location.search.includes("slack=connected")) {
      setSlackConnected(true);
      navigate("/", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (authState !== "authed") return;
    api
      .getCounts()
      .then(setCounts)
      .catch(() => undefined);
  }, [authState, location.pathname, location.search]);
  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAuthState("guest");
    navigate("/login");
  };

  const handleConnectSlack = () => {
    if (api.mocksEnabled) {
      // No backend to run the real OAuth flow against — simulate connecting.
      setSlackConnected(true);
      return;
    }
    api.connectSlack();
  };

  if (authState === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
      </div>
    );
  }

  if (authState === "guest") {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="*"
        element={
          <div className="flex h-full">
            <Sidebar
              user={user!}
              counts={counts}
              slackConnected={slackConnected}
              onConnectSlack={handleConnectSlack}
              onDisconnectSlack={async () => {
                await api.disconnectSlack();
                setSlackConnected(false);
              }}
              onTestSlack={() => api.sendTestSlackMessage()}
              onLogout={handleLogout}
            />
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    slackConnected={slackConnected}
                    onConnectSlack={handleConnectSlack}
                  />
                }
              />
              <Route path="/emails/:id" element={<EmailDetail />} />
              <Route path="/compose" element={<Compose />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        }
      />
      <Route path="/login" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
