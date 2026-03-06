"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────
interface ErrorLogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  stack?: string | null;
  code?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  locale?: string | null;
  inputMeta?: Record<string, unknown> | null;
  resolved: boolean;
  notes?: string | null;
  createdAt: string;
}

interface Summary {
  byLevel: Record<string, number>;
  byCode: Record<string, number>;
  bySource: Record<string, number>;
}

interface ErrorsResponse {
  errors: ErrorLogEntry[];
  total: number;
  unresolvedCount: number;
  summary: Summary;
  pagination: { limit: number; offset: number; hasMore: boolean };
  period: { from: string; to: string };
}

// ── Helpers ────────────────────────────────────────────────
function adminHeaders(): HeadersInit {
  const token = sessionStorage.getItem("adminToken");
  return token ? { "x-admin-token": token } : {};
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function levelBadge(level: string) {
  const colors: Record<string, string> = {
    fatal: "bg-red-100 text-red-800 border-red-200",
    error: "bg-orange-100 text-orange-800 border-orange-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
  };
  return colors[level] ?? "bg-gray-100 text-gray-800 border-gray-200";
}

function codeBadge(code: string) {
  const colors: Record<string, string> = {
    GENERATION_FAILED: "bg-red-50 text-red-700",
    GENERATION_DEGRADED: "bg-amber-50 text-amber-700",
    STREAM_FAILED: "bg-red-50 text-red-700",
    CIRCUIT_OPEN: "bg-purple-50 text-purple-700",
    RATE_LIMITED: "bg-blue-50 text-blue-700",
    LLM_TIMEOUT: "bg-orange-50 text-orange-700",
    EXPORT_FAILED: "bg-pink-50 text-pink-700",
  };
  return colors[code] ?? "bg-gray-50 text-gray-600";
}

// ── Page ───────────────────────────────────────────────────
export default function ErrorsPage() {
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Filters
  const [level, setLevel] = useState("");
  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState("false"); // default: unresolved
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from,
        to,
        offset: String(offset),
        limit: "50",
      });
      if (level) params.set("level", level);
      if (code) params.set("code", code);
      if (resolved) params.set("resolved", resolved);

      const res = await fetch(`/api/admin/errors?${params}`, {
        headers: adminHeaders(),
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch errors:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to, level, code, resolved, offset]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  async function toggleResolved(id: string, currentResolved: boolean) {
    await fetch(`/api/admin/errors/${id}`, {
      method: "PATCH",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !currentResolved }),
    });
    fetchErrors();
  }

  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/admin/errors/${id}`, {
      method: "PATCH",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    fetchErrors();
  }

  const summary = data?.summary;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Error Logs
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {data
              ? `${data.unresolvedCount} unresolved · ${data.total} in range`
              : "Loading..."}
          </p>
        </div>
        <button
          onClick={() => { setOffset(0); fetchErrors(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(["fatal", "error", "warn"] as const).map((lvl) => (
            <div
              key={lvl}
              className="bg-white rounded-xl border border-[var(--border-light)] px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
                {lvl}
              </p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {summary.byLevel[lvl] ?? 0}
              </p>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-[var(--border-light)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
              Unresolved
            </p>
            <p className="text-xl font-bold text-red-600">
              {data?.unresolvedCount ?? 0}
            </p>
          </div>
        </div>
      )}

      {/* Top error codes breakdown */}
      {summary && Object.keys(summary.byCode).length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--border-light)] p-4 mb-6">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
            Top error codes
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byCode)
              .sort(([, a], [, b]) => b - a)
              .map(([c, count]) => (
                <button
                  key={c}
                  onClick={() => { setCode(code === c ? "" : c); setOffset(0); }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    code === c
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : `${codeBadge(c)} border-[var(--border-light)]`
                  }`}
                >
                  {c} ({count})
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setOffset(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
        />
        <span className="text-xs text-[var(--text-muted)]">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setOffset(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
        />

        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value); setOffset(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
        >
          <option value="">All levels</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
        </select>

        <select
          value={resolved}
          onChange={(e) => { setResolved(e.target.value); setOffset(0); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)]"
        >
          <option value="">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>

        {(level || code || resolved !== "false") && (
          <button
            onClick={() => { setLevel(""); setCode(""); setResolved("false"); setOffset(0); }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error list */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          Loading errors...
        </div>
      ) : !data || data.errors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">
            {data?.total === 0
              ? "No errors in this period. Nice! 🎉"
              : "No errors match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.errors.map((err) => (
            <div
              key={err.id}
              className={`bg-white rounded-xl border transition-colors ${
                err.resolved
                  ? "border-[var(--border-light)] opacity-60"
                  : "border-[var(--border)]"
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3"
              >
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${levelBadge(
                      err.level
                    )}`}
                  >
                    {err.level.toUpperCase()}
                  </span>
                  {err.resolved && (
                    <span className="text-[10px] text-green-600 font-medium">
                      ✓ fixed
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      {err.source}
                    </span>
                    {err.code && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${codeBadge(
                          err.code
                        )}`}
                      >
                        {err.code}
                      </span>
                    )}
                    {err.statusCode && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        HTTP {err.statusCode}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-primary)] truncate">
                    {err.message}
                  </p>
                </div>

                <span className="text-[10px] text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                  {formatDate(err.createdAt)}
                </span>
              </button>

              {/* Expanded detail */}
              {expanded === err.id && (
                <div className="border-t border-[var(--border-light)] px-4 py-4 space-y-3">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {err.requestId && (
                      <div>
                        <span className="text-[var(--text-muted)]">Request ID</span>
                        <p className="font-mono text-[var(--text-primary)] truncate">
                          {err.requestId}
                        </p>
                      </div>
                    )}
                    {err.ip && (
                      <div>
                        <span className="text-[var(--text-muted)]">IP</span>
                        <p className="font-mono text-[var(--text-primary)]">{err.ip}</p>
                      </div>
                    )}
                    {err.locale && (
                      <div>
                        <span className="text-[var(--text-muted)]">Locale</span>
                        <p className="text-[var(--text-primary)]">{err.locale}</p>
                      </div>
                    )}
                    {err.userId && (
                      <div>
                        <span className="text-[var(--text-muted)]">User ID</span>
                        <p className="font-mono text-[var(--text-primary)] truncate">
                          {err.userId}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* User agent */}
                  {err.userAgent && (
                    <div className="text-xs">
                      <span className="text-[var(--text-muted)]">User Agent</span>
                      <p className="font-mono text-[var(--text-secondary)] text-[11px] truncate">
                        {err.userAgent}
                      </p>
                    </div>
                  )}

                  {/* Input metadata */}
                  {err.inputMeta && (
                    <div className="text-xs">
                      <span className="text-[var(--text-muted)]">Input Meta</span>
                      <pre className="mt-1 bg-[var(--surface-secondary)] text-[11px] font-mono p-2 rounded-lg overflow-auto max-h-24 text-[var(--text-secondary)]">
                        {JSON.stringify(err.inputMeta, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Stack trace */}
                  {err.stack && (
                    <div className="text-xs">
                      <span className="text-[var(--text-muted)]">Stack Trace</span>
                      <pre className="mt-1 bg-gray-900 text-gray-300 text-[11px] font-mono p-3 rounded-lg overflow-auto max-h-48">
                        {err.stack}
                      </pre>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="text-xs">
                    <span className="text-[var(--text-muted)]">Notes</span>
                    <textarea
                      defaultValue={err.notes ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (err.notes ?? "")) {
                          saveNotes(err.id, e.target.value);
                        }
                      }}
                      placeholder="Add investigation notes..."
                      rows={2}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-lg border border-[var(--border)] bg-white text-[var(--text-primary)] resize-y"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={() => toggleResolved(err.id, err.resolved)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        err.resolved
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {err.resolved ? "↩ Reopen" : "✓ Mark resolved"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-[var(--text-muted)]">
            Showing {offset + 1}–{Math.min(offset + data.errors.length, data.total)}{" "}
            of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
            >
              ← Prev
            </button>
            <button
              disabled={!data.pagination.hasMore}
              onClick={() => setOffset(offset + 50)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[var(--text-secondary)] disabled:opacity-40 hover:bg-[var(--surface-secondary)]"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
