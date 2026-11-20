'use client';

import React from 'react';
import { Activity, Info } from 'lucide-react';
import { ScoreBadge } from '@/components/shared/score-badge';
import { formatINR } from '@/lib/formatters';

// Demonstration fixtures for UI table layout verification only.
// Real monitoring surveillance will be executed via packages/core and packages/db in Phase 1B.
const DEMO_MONITORED_POSITIONS = [
  {
    symbol: 'TCS',
    cmp: 4120.5,
    lastReviewDate: '2026-10-15',
    status: 'TRACKED',
  },
  {
    symbol: 'INFY',
    cmp: 1845.2,
    lastReviewDate: '2026-10-18',
    status: 'TRACKED',
  },
  {
    symbol: 'TITAN',
    cmp: 3550.0,
    lastReviewDate: '2026-10-22',
    status: 'TRACKED',
  },
];

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage G: Position Monitoring (UI Scaffolding)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Workstation layout for tracked positions. No automated exit triggers or stop loss calculations are executed client-side.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Policy Neutrality & Surveillance Boundary Notice:</strong>
          <p className="mt-1 text-slate-400">
            Trailing stop adjustment policies (Decision 18), quarterly result audit thresholds (Decision 19),
            and automated exit rules are strictly <strong className="text-amber-400 font-mono">PENDING USER DECISION</strong>.
            This screen provides only presentation scaffolding and does not execute automated exit decisions.
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Demonstration Monitored Universe</h2>
          <span className="text-xs text-amber-400 font-mono">Demonstration Fixture</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4 text-right">Demonstration CMP</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Review Date</th>
                <th className="py-2.5 px-4 text-center">Surveillance Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {DEMO_MONITORED_POSITIONS.map((pos) => (
                <tr key={pos.symbol} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-cyan-400">{pos.symbol}</td>
                  <td className="py-3 px-4 text-right text-slate-100">{formatINR(pos.cmp)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {pos.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400">{pos.lastReviewDate}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-amber-400 text-[10px]">PENDING_ENGINE_INTEGRATION</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
