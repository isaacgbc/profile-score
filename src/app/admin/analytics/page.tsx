"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

// ── Types ──────────────────────────────────────────────
interface FunnelStep {
  step: string;
  count: number;
  conversionFromPrevious: number;
}

interface FunnelData {
  period: { from: string; to: string };
  counts: Record<string, number>;
  funnel: FunnelStep[];
  uniqueSessions: number;
  totalEvents: number;
}

interface EvalQualityData {
  period: { from: string; to: string };
  tierCounts: Record<string, number>;
  scoreBuckets: Record<string, number>;
  avgScore: number;
  totalAudits: number;
  totalInPage: number;
  fallbackCount: number;
  fallbackRate: number;
  modelCounts: Record<string, number>;
}

// ── Tier display config ──────────────────────────────
const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: "Excellent", color: "text-emerald-700", bg: "bg-emerald-500" },
  good: { label: "Good", color: "text-blue-700", bg: "bg-blue-500" },
  fair: { label: "Fair", color: "text-amber-700", bg: "bg-amber-500" },
  poor: { label: "Poor", color: "text-red-700", bg: "bg-red-500" },
};

const BUCKET_ORDER = ["0-20", "21-40", "41-60", "61-80", "81-100"];

// ── Human-readable step names ──────────────────────────
const STEP_LABELS: Record<string, string> = {
  landing_view: "Landing View",
  start_audit: "Start Audit",
  audit_completed: "Audit Completed",
  plan_selected: "Plan Selected",
  checkout_opened: "Checkout Opened",
  export_clicked: "Export Clicked",
};

// ── Date helpers ───────────────────────────────────────
function toLocalDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Admin Analytics Page ───────────────────────────────
export default function AdminAnalyticsPage() {
  const [from, setFrom] = useState(toLocalDateString(daysAgo(7)));
  const [to, setTo] = useState(toLocalDateString(new Date()));
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Eval quality state ──
  const [evalData, setEvalData] = useState<EvalQualityData | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState("");

  // Admin token helper
  const getAdminToken = () =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminToken") ?? ""
      : "";

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getAdminToken();

    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/analytics/funnel?${params}`, {
        headers: { "x-admin-token": token },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 && body.reason === "admin_session_expired") {
          setError("Admin session expired. Please refresh the page or re-login.");
        } else {
          setError(body.error ?? `Error ${res.status}`);
        }
        setData(null);
        return;
      }

      const json: FunnelData = await res.json();
      setData(json);
    } catch {
      setError("Failed to fetch analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const fetchEvalQuality = useCallback(async () => {
    setEvalLoading(true);
    setEvalError("");

    const token = getAdminToken();

    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/eval-quality?${params}`, {
        headers: { "x-admin-token": token },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 && body.reason === "admin_session_expired") {
          setEvalError("Admin session expired. Please refresh the page or re-login.");
        } else {
          setEvalError(body.error ?? `Error ${res.status}`);
        }
        setEvalData(null);
        return;
      }

      const json: EvalQualityData = await res.json();
      setEvalData(json);
    } catch {
      setEvalError("Failed to fetch eval quality");
      setEvalData(null);
    } finally {
      setEvalLoading(false);
    }
  }, [from, to]);

  // Fetch on mount + date change
  useEffect(() => {
    fetchFunnel();
    fetchEvalQuality();
  }, [fetchFunnel, fetchEvalQuality]);

  const maxCount =
    data?.funnel.reduce((max, s) => Math.max(max, s.count), 0) ?? 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Funnel Analytics
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Track user journey from landing to export.
        </p>
      </div>

      {/* Date range controls */}
      <Card variant="default" padding="md" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={fetchFunnel}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Unique Sessions
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {data.uniqueSessions.toLocaleString()}
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Total Events
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {data.totalEvents.toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Funnel visualization */}
          <Card variant="default" padding="lg" className="mb-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">
              Conversion Funnel
            </h2>

            {data.funnel.length === 0 || data.totalEvents === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                No events in this date range.
              </p>
            ) : (
              <div className="space-y-3">
                {data.funnel.map((step, i) => {
                  const widthPct =
                    maxCount > 0
                      ? Math.max((step.count / maxCount) * 100, 2)
                      : 2;

                  return (
                    <div key={step.step}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--text-muted)] w-5 text-right">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {STEP_LABELS[step.step] ?? step.step}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                            {step.count.toLocaleString()}
                          </span>
                          {i > 0 && (
                            <Badge
                              variant={
                                step.conversionFromPrevious >= 50
                                  ? "success"
                                  : step.conversionFromPrevious >= 20
                                    ? "free"
                                    : "accent"
                              }
                            >
                              {step.conversionFromPrevious.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="ml-7 h-6 bg-[var(--surface-secondary)] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500 ease-out"
                          style={{
                            width: `${widthPct}%`,
                            background:
                              i === 0
                                ? "var(--accent)"
                                : `color-mix(in srgb, var(--accent) ${100 - i * 12}%, #6366f1)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Conversion table */}
          <Card variant="default" padding="lg">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Step-by-Step Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="text-left py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Step
                    </th>
                    <th className="text-right py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Count
                    </th>
                    <th className="text-right py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Conversion
                    </th>
                    <th className="text-right py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Drop-off
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map((step, i) => {
                    const prev = i > 0 ? data.funnel[i - 1].count : step.count;
                    const dropoff = prev > 0 ? prev - step.count : 0;
                    return (
                      <tr
                        key={step.step}
                        className="border-b border-[var(--border-light)] last:border-0"
                      >
                        <td className="py-2.5 text-[var(--text-primary)] font-medium">
                          {STEP_LABELS[step.step] ?? step.step}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--text-secondary)]">
                          {step.count.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {i === 0 ? (
                            <span className="text-[var(--text-muted)]">—</span>
                          ) : (
                            <span
                              className={
                                step.conversionFromPrevious >= 50
                                  ? "text-emerald-600 font-medium"
                                  : step.conversionFromPrevious >= 20
                                    ? "text-amber-600"
                                    : "text-red-500"
                              }
                            >
                              {step.conversionFromPrevious.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-[var(--text-muted)]">
                          {i === 0 ? "—" : `-${dropoff.toLocaleString()}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Score Quality Section ─────────────────────── */}
      <div className="mt-10 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Score Quality
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Audit score distribution and LLM reliability metrics.
        </p>
      </div>

      {evalError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{evalError}</p>
        </div>
      )}

      {evalLoading && !evalData && (
        <Card variant="default" padding="lg" className="mb-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
            <span className="ml-3 text-sm text-[var(--text-muted)]">Loading score quality...</span>
          </div>
        </Card>
      )}

      {evalData && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Total Audits
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {evalData.totalAudits.toLocaleString()}
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Avg Score
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {evalData.avgScore.toFixed(1)}%
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Fallback Rate
              </p>
              <p className={`text-2xl font-bold ${evalData.fallbackRate > 0.1 ? "text-red-600" : evalData.fallbackRate > 0.05 ? "text-amber-600" : "text-emerald-600"}`}>
                {(evalData.fallbackRate * 100).toFixed(1)}%
              </p>
            </Card>
            <Card variant="default" padding="md">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Fallbacks
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {evalData.fallbackCount.toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Tier Distribution */}
          <Card variant="default" padding="lg" className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Tier Distribution
            </h3>
            {evalData.totalAudits === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">
                No audits in this date range.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(TIER_CONFIG).map(([tier, config]) => {
                  const count = evalData.tierCounts[tier] ?? 0;
                  const pct = evalData.totalInPage > 0
                    ? (count / evalData.totalInPage) * 100
                    : 0;
                  return (
                    <div key={tier}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm tabular-nums text-[var(--text-secondary)]">
                            {count}
                          </span>
                          <Badge variant="muted">
                            {pct.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="h-5 bg-[var(--surface-secondary)] rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg transition-all duration-500 ease-out ${config.bg}`}
                          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, opacity: 0.75 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Score Buckets */}
          <Card variant="default" padding="lg" className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Score Buckets (% of max)
            </h3>
            {evalData.totalAudits === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">
                No audits in this date range.
              </p>
            ) : (
              <div className="space-y-2.5">
                {BUCKET_ORDER.map((bucket) => {
                  const count = evalData.scoreBuckets[bucket] ?? 0;
                  const pct = evalData.totalInPage > 0
                    ? (count / evalData.totalInPage) * 100
                    : 0;
                  return (
                    <div key={bucket} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--text-muted)] w-12 text-right shrink-0">
                        {bucket}
                      </span>
                      <div className="flex-1 h-5 bg-[var(--surface-secondary)] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                            background: "var(--accent)",
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-[var(--text-secondary)] w-16 text-right shrink-0">
                        {count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Model Usage */}
          {Object.keys(evalData.modelCounts).length > 0 && (
            <Card variant="default" padding="lg" className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                Model Usage
              </h3>
              <div className="space-y-1.5">
                {Object.entries(evalData.modelCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between py-1">
                      <span className="text-sm font-mono text-[var(--text-secondary)]">
                        {model}
                      </span>
                      <Badge variant="muted">{count}</Badge>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
