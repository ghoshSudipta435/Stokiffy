'use client';

import React from 'react';
import Link from 'next/link';
import {
  Layers,
  Filter,
  ArrowRight,
  ShieldAlert,
  Info,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { FinancialMetric } from '@/components/shared/financial-metric';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { EmptyState } from '@/components/shared/empty-state';
import { useDashboard } from '@/hooks/use-dashboard';
import { useAlerts } from '@/hooks/use-alerts';

const STAGE_LABELS: Record<string, string> = {
  A: 'Stage A — Quick Screen',
  B: 'Stage B — Deep Trend',
  C: 'Stage C — Moat & Governance',
  D: 'Stage D — Valuation',
  E: 'Stage E — Tech Entry',
  F: 'Stage F — Buy Plan',
  G: 'Stage G — Monitoring',
};

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError } = useDashboard();
  const { alerts, isLoading: alertsLoading } = useAlerts();

  const funnel = dashboard?.funnel ?? [];
  const portfolio = dashboard?.portfolio;
  const activeAlerts = (alerts ?? []).filter((a) => !a.acknowledgedAt).slice(0, 5);

  if (dashboardLoading || alertsLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <Activity className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading workstation data…</p>
      </div>
    );
  }

  if ((dashboardError && !dashboard) || (!dashboard && !alerts)) {
    return (
      <div className="p-12 text-center">
        <EmptyState
          title="Unable to load dashboard"
          description="Failed to fetch workstation data. Please try again."
          action={{ label: "Retry", onClick: () => window.location.reload() }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Workstation Executive Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Personal Investment Lifecycle & Research Workstation • Indian Equities (NSE/BSE)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/screener"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors shadow-lg shadow-cyan-950/40"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Open Screener Workstation</span>
          </Link>
        </div>
      </div>

      {/* Scope & Policy Neutrality Banner */}
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Phase 1A Baseline Architecture Notice:</strong>
          <p className="mt-1 text-slate-400 leading-relaxed">
            This workstation provides the structural UI and technical API/worker foundation.
            In accordance with Phase 1A governance, no financial scoring engines or unapproved portfolio caps are active.
            All 20 canonical investment policy decisions remain strictly <strong className="text-amber-400 font-mono">PENDING USER DECISION</strong>.
          </p>
        </div>
      </div>

      {/* Portfolio KPI Cards */}
      {portfolio && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FinancialMetric
            label="Total Portfolio Value"
            value={portfolio.totalValue > 0 ? `₹${portfolio.totalValue.toLocaleString('en-IN')}` : '—'}
            subValue={`Cash: ₹${portfolio.cash.toLocaleString('en-IN')} • ${portfolio.positionsCount} positions`}
          />
          <FinancialMetric
            label="Unrealised P&L"
            value={
              portfolio.unrealisedPnl >= 0 ? `+${formatINR(portfolio.unrealisedPnl)}` : `-${formatINR(Math.abs(portfolio.unrealisedPnl))}`
            }
            subValue={formatPercent(portfolio.unrealisedPnlPct)}
          />
          <FinancialMetric
            label="Cash Buffer"
            value={formatPercent(portfolio.cashBufferPct)}
            subValue="Reserve vs total value"
          />
          <FinancialMetric
            label="Live Alerts"
            value={activeAlerts.length}
            subValue={activeAlerts.length > 0 ? 'Requires attention' : 'All clear'}
          />
        </div>
      )}

      {/* 7-Stage Funnel Overview (Live Counts) */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">
              7-Stage Investment Lifecycle — Live Funnel
            </h2>
            <p className="text-xs text-slate-400">
              Real-time counts of companies at each stage.{' '}
              {dashboard?.updatedAt && <span className="text-slate-500 font-mono text-[10px]">Updated {new Date(dashboard.updatedAt).toLocaleTimeString()}</span>}
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">Modular Monolith</span>
        </div>

        {funnel.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs font-mono">
            No stage data available. Run Stage A screening to populate the funnel.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
            {funnel.map((item) => {
              const total = item.eligible + item.blocked;
              const pct = total > 0 ? Math.round((item.eligible / total) * 100) : 0;
              return (
                <div
                  key={item.stage}
                  className="p-3 rounded-md bg-slate-950/80 border border-slate-800"
                >
                  <Link
                    href={`/companies/${item.stage.toLowerCase()}`}
                    className="block"
                  >
                    <div className="text-[10px] font-mono text-cyan-400/90 font-bold uppercase">
                      {item.stage}
                    </div>
                    <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                      {STAGE_LABELS[item.stage] ?? item.name}
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      {item.count} tracked
                    </div>
                    <div className="text-[10px] font-mono mt-2 px-1 py-0.5 rounded border truncate">
                      {item.blocked > 0
                        ? `🔒 ${item.blocked} blocked`
                        : item.eligible > 0
                        ? `✅ ${item.eligible} eligible`
                        : '—'}
                    </div>
                    <div className="w-full bg-slate-800/50 rounded h-1.5 mt-2 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/40"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Active Alerts */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-slate-200">Top Active Alerts</h2>
          </div>
          <Link
            href="/monitoring"
            className="text-xs font-medium text-cyan-400 hover:underline"
          >
            View Monitoring Centre <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </div>

        <div className="divide-y divide-slate-800/60">
          {activeAlerts.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              No active alerts. All tracked positions are clear.
            </div>
          ) : (
            activeAlerts.map((alert) => (
              <div key={alert.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                      alert.severity === 'critical'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : alert.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <Link
                      href={`/companies/${alert.symbol}`}
                      className="text-xs font-bold text-slate-200 hover:underline font-mono"
                    >
                      {alert.symbol}
                    </Link>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(alert.triggeredAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mb-1">{alert.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: value >= 0 ? 'exceptZero' : 'always',
  }).format(value / 100);
}
