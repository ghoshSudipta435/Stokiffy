'use client';

import React from 'react';
import { PieChart, Info } from 'lucide-react';
import { FinancialMetric } from '@/components/shared/financial-metric';
import { formatINR } from '@/lib/formatters';

// Demonstration fixtures for UI layout verification only.
// Real portfolio holdings will be loaded from packages/db in Phase 1B.
const DEMO_HOLDINGS = [
  { symbol: 'TCS', sector: 'Information Technology', shares: 250, avgPrice: 3850, cmp: 4120.5, value: 1030125 },
  { symbol: 'INFY', sector: 'Information Technology', shares: 500, avgPrice: 1650, cmp: 1845.2, value: 922600 },
  { symbol: 'HDFCBANK', sector: 'Financial Services', shares: 600, avgPrice: 1580, cmp: 1650.0, value: 990000 },
  { symbol: 'TITAN', sector: 'Consumer Discretionary', shares: 200, avgPrice: 3200, cmp: 3550.0, value: 710000 },
];

export default function PortfolioPage() {
  const totalValue = DEMO_HOLDINGS.reduce((sum, h) => sum + h.value, 0);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage F: Portfolio Risk & Position Layout (Neutral Scaffolding)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Workstation layout for portfolio positions and risk metrics. Allocation limits remain pending user policy decisions.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Policy Neutrality Notice:</strong>
          <p className="mt-1 text-slate-400">
            Sector concentration caps (Decision 16), single stock position limits (Decision 15), and cash buffer thresholds (Decision 17)
            remain strictly <strong className="text-amber-400 font-mono">PENDING USER DECISION</strong>.
            No policy limits or compliance verdicts are hardcoded in this view.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FinancialMetric
          label="Demonstration Total Value"
          value={formatINR(totalValue)}
          subValue="4 sample equity holdings [DEMO]"
        />
        <FinancialMetric
          label="Tracked Equity Positions"
          value={`${DEMO_HOLDINGS.length} Positions`}
          subValue="Demonstration holdings fixture"
        />
        <FinancialMetric
          label="Policy Governance Status"
          value="Pending Decisions"
          subValue="Decisions 15, 16, 17 unapproved"
        />
      </div>

      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Demonstration Position Allocations</h2>
          <span className="text-xs text-amber-400 font-mono">Sample Fixture Data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">Sector</th>
                <th className="py-2.5 px-4 text-right">Shares</th>
                <th className="py-2.5 px-4 text-right">Avg Price</th>
                <th className="py-2.5 px-4 text-right">CMP (INR)</th>
                <th className="py-2.5 px-4 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {DEMO_HOLDINGS.map((h) => (
                <tr key={h.symbol} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-cyan-400">{h.symbol}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-300">{h.sector}</td>
                  <td className="py-2.5 px-4 text-right text-slate-200">{h.shares}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">{formatINR(h.avgPrice)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-100 font-bold">{formatINR(h.cmp)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-200">{formatINR(h.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
