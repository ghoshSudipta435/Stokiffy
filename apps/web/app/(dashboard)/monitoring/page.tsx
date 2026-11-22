'use client';

import React, { useState } from 'react';
import {
  Activity,
  Info,
} from 'lucide-react';
import { FinancialMetric } from '@/components/shared/financial-metric';
import { formatINR } from '@/lib/formatters';
import { useAlerts } from '@/hooks/use-alerts';

type StatusFilter = 'all' | 'active' | 'acknowledged';
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

export default function MonitoringPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const acknowledged = statusFilter === 'acknowledged' ? true : statusFilter === 'active' ? false : undefined;
  const severity = severityFilter === 'all' ? undefined : severityFilter;

  const {
    alerts,
    isLoading: alertsLoading,
    acknowledgeAlert,
    isAcknowledging,
  } = useAlerts({ severity, acknowledged });

  const activeCount = alerts.filter((a) => !a.acknowledgedAt).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledgedAt).length;

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert({ alertId, notes: 'Acknowledged via Monitoring Centre' });
    } catch {
      // Error surfaced by API route
    }
  };

  if (alertsLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <Activity className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading alerts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage G: Monitoring Centre
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Surveillance alerts for tracked positions. Filter by status and severity, and acknowledge with rationale.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Alert Governance:</strong>
          <p className="mt-1 text-slate-400">
            Acknowledging an alert preserves it as auditable history and creates an AuditEvent. Original alert
            records remain immutable.
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FinancialMetric
          label="Total Alerts"
          value={alerts.length}
          subValue={`${activeCount} active`}
        />
        <FinancialMetric
          label="Critical (Unacked)"
          value={criticalCount}
          subValue="Requires immediate attention"
        />
        <FinancialMetric
          label="Acknowledged"
          value={alerts.filter((a) => a.acknowledgedAt).length}
          subValue="Resolved or under review"
        />
        <FinancialMetric
          label="Active"
          value={activeCount}
          subValue="Open surveillance items"
        />
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'border-transparent text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('acknowledged')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                statusFilter === 'acknowledged'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'border-transparent text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              Acknowledged
            </button>
          </div>
          <div className="flex gap-2">
            {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  severityFilter === sev
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'border-transparent text-slate-400 hover:bg-slate-800/60'
              }`}
              >
                {sev === 'all' ? 'All Severity' : SEVERITY_LABELS[sev]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-200">Surveillance Alerts</h2>
        </div>

        <div className="overflow-x-auto">
          {alerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-500 text-xs">
              No alerts match the current filters.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-center">Severity</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Triggered At</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {alerts.map((alert) => {
                  const acknowledged = Boolean(alert.acknowledgedAt);
                  return (
                    <tr
                      key={alert.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-cyan-400 truncate">
                        {alert.symbol ?? '—'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300 truncate">
                        {alert.type}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                          alert.severity === 'critical'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : alert.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                          acknowledged
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                        {new Date(alert.triggeredAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-300 truncate max-w-[200px]">
                        {alert.message}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {acknowledged ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                            Done
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(alert.id!)}
                            disabled={isAcknowledging}
                            className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-[10px] transition-colors disabled:opacity-50"
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
