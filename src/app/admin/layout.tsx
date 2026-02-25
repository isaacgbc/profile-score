"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useApp();
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");

  // Check session storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("adminToken");
    if (stored) setAuthed(true);
  }, []);

  // Also allow if app-level admin mode is active (for dev convenience)
  const hasAccess = authed || isAdmin;

  function handleLogin() {
    if (!token.trim()) return;
    sessionStorage.setItem("adminToken", token.trim());
    setAuthed(true);
    setError("");
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-secondary)]">
        <div className="bg-white rounded-2xl border border-[var(--border)] p-8 w-full max-w-sm shadow-sm">
          <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Admin Access
          </h1>
          <p className="text-xs text-[var(--text-muted)] mb-6">
            Enter the admin secret to continue.
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Admin secret"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)] mb-3"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-600 mb-3">{error}</p>
          )}
          <Button variant="primary" size="sm" fullWidth onClick={handleLogin}>
            Sign In
          </Button>
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              Back to app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-secondary)]">
      {/* Admin nav bar */}
      <header className="bg-white border-b border-[var(--border-light)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]"
            >
              Profile Score
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin/prompts"
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              Prompts
            </Link>
            <Link
              href="/admin/analytics"
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
            >
              Analytics
            </Link>
            <button
              onClick={() => {
                sessionStorage.removeItem("adminToken");
                setAuthed(false);
              }}
              className="text-xs text-[var(--text-muted)] hover:text-red-600"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
