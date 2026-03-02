"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface FeedbackItem {
  id: string;
  eventName: string;
  sessionId: string | null;
  metadata: Record<string, unknown> | null;
  path: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  page: number;
  totalPages: number;
}

function toLocalDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill={s <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          className={s <= rating ? "text-amber-400" : "text-gray-300"}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<"all" | "feedback" | "bugs">("all");
  const [from, setFrom] = useState(toLocalDateString(daysAgo(30)));
  const [to, setTo] = useState(toLocalDateString(new Date()));
  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const getAdminToken = () =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminToken") ?? ""
      : "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const token = getAdminToken();

    try {
      const params = new URLSearchParams({
        from,
        to,
        page: String(page),
        limit: "30",
      });
      if (tab !== "all") params.set("type", tab);

      const res = await fetch(`/api/admin/feedback?${params}`, {
        headers: { "x-admin-token": token },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        setData(null);
        return;
      }

      const json: FeedbackResponse = await res.json();
      setData(json);
    } catch {
      setError("Failed to fetch feedback data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, tab, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const feedbackCount = data?.items.filter((i) => i.eventName === "feedback_submitted").length ?? 0;
  const bugCount = data?.items.filter((i) => i.eventName === "bug_report_submitted").length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          User Feedback
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Feedback submissions and bug reports from users.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "feedback", "bugs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              tab === t
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            {t === "all" ? "All" : t === "feedback" ? "Feedback" : "Bug Reports"}
          </button>
        ))}
      </div>

      {/* Date range */}
      <Card variant="default" padding="md" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
            />
          </div>
          <Button variant="primary" size="sm" onClick={fetchData} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </Button>
          {data && (
            <span className="text-xs text-[var(--text-muted)] ml-auto">
              {data.total} total entries
            </span>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card variant="default" padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{data.total}</p>
          </Card>
          <Card variant="default" padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Feedback</p>
            <p className="text-2xl font-bold text-blue-600">{feedbackCount}</p>
          </Card>
          <Card variant="default" padding="md">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Bugs</p>
            <p className="text-2xl font-bold text-red-600">{bugCount}</p>
          </Card>
        </div>
      )}

      {/* Items list */}
      {data && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((item) => {
            const isFeedback = item.eventName === "feedback_submitted";
            const meta = (item.metadata ?? {}) as Record<string, unknown>;

            return (
              <Card key={item.id} variant="default" padding="md" className="animate-slide-up">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={isFeedback ? "free" : "accent"}>
                      {isFeedback ? "Feedback" : "Bug Report"}
                    </Badge>
                    {isFeedback && meta.rating != null && (
                      <StarDisplay rating={Number(meta.rating)} />
                    )}
                    {!isFeedback && !!meta.severity && (
                      <Badge
                        variant={
                          meta.severity === "high"
                            ? "accent"
                            : meta.severity === "medium"
                              ? "free"
                              : "muted"
                        }
                      >
                        {String(meta.severity).toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Feedback-specific */}
                {isFeedback && (
                  <div className="space-y-2 text-sm">
                    {!!meta.useful && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">Most useful: </span>
                        <span className="text-[var(--text-secondary)]">{String(meta.useful)}</span>
                      </div>
                    )}
                    {meta.recommend != null && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">Would recommend: </span>
                        <span className={meta.recommend === true ? "text-emerald-600 font-medium" : meta.recommend === false ? "text-red-500" : "text-[var(--text-muted)]"}>
                          {meta.recommend === true ? "Yes" : meta.recommend === false ? "No" : "Skipped"}
                        </span>
                      </div>
                    )}
                    {!!meta.improve && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">To improve: </span>
                        <span className="text-[var(--text-secondary)]">{String(meta.improve)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bug report-specific */}
                {!isFeedback && (
                  <div className="space-y-2 text-sm">
                    {!!meta.description && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">Description: </span>
                        <span className="text-[var(--text-secondary)]">{String(meta.description)}</span>
                      </div>
                    )}
                    {!!meta.steps && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">Steps: </span>
                        <span className="text-[var(--text-secondary)] whitespace-pre-wrap">{String(meta.steps)}</span>
                      </div>
                    )}
                    {!!meta.reportUrl && (
                      <div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">URL: </span>
                        <code className="text-xs text-[var(--accent)]">{String(meta.reportUrl)}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* Session + path */}
                <div className="mt-3 pt-3 border-t border-[var(--border-light)] flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
                  {item.path && <span>Page: {item.path}</span>}
                  {item.sessionId && <span>Session: {item.sessionId.slice(0, 8)}…</span>}
                </div>
              </Card>
            );
          })}
        </div>
      ) : data && data.items.length === 0 ? (
        <Card variant="default" padding="lg">
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            No feedback or bug reports in this date range.
          </p>
        </Card>
      ) : null}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-[var(--text-muted)]">
            Page {data.page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
