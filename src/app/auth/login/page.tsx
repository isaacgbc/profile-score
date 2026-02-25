"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
    }
    // If no error, the browser will redirect to Google
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="max-w-md w-full mx-4 p-8 bg-white rounded-2xl shadow-sm border border-[var(--border-light)]">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Check your email
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-sm text-[var(--accent)] hover:underline"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="max-w-md w-full mx-4 p-8 bg-white rounded-2xl shadow-sm border border-[var(--border-light)]">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <BrandLogo size={36} className="rounded-lg" />
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              Profile Score
            </span>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Sign in to your account
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Access your saved audits and manage your subscription
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--border-light)]
            bg-white hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] font-medium text-sm
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-light)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-[var(--text-muted)]">or</span>
          </div>
        </div>

        {/* Email magic link */}
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-[var(--border-light)] bg-white
                text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]
                transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full px-4 py-3 rounded-xl bg-[var(--accent)] text-white font-medium text-sm
              hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>

        <p className="text-xs text-center text-[var(--text-muted)] mt-6">
          No account yet? We&apos;ll create one automatically when you sign in.
        </p>
      </div>
    </div>
  );
}
