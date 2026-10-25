import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Button, Input } from "../components/ui";
import { GoogleIcon } from "../components/GoogleIcon";

type Mode = "login" | "signup";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real Google OAuth via the backend; simulated in mock-preview mode.
  const handleGoogleLogin = () => {
    if (import.meta.env.VITE_USE_MOCKS === "true") {
      navigate("/");
      return;
    }
    window.location.href = "/api/auth/google";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (import.meta.env.VITE_USE_MOCKS === "true") {
      if (!email.trim() || !password.trim()) {
        setError("Please enter your email and password.");
        return;
      }
      setLoading(true);
      await new Promise((r) => setTimeout(r, 400));
      setLoading(false);
      navigate("/");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.register(name.trim(), email.trim(), password);
      } else {
        await api.login(email.trim(), password);
      }
      // Full reload so App picks up the new session cookie.
      window.location.replace("/");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError(null);
  };

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          {isSignup ? "Sign up" : "Login"}
        </h1>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-8 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-soft text-sm font-medium text-gray-800 transition hover:brightness-95"
        >
          <GoogleIcon />
          {isSignup ? "Sign up with Google" : "Login with Google"}
        </button>

        <div className="mt-4 flex items-center justify-center">
          <span className="text-xs text-gray-400">or {isSignup ? "sign up" : "sign in"} through email</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {isSignup && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder={isSignup ? "Password (min. 6 characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full rounded-lg">
            {loading ? "Please wait..." : isSignup ? "Sign up" : "Login"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-500">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="cursor-pointer font-semibold text-brand hover:underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
