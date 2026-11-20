'use client';

import React from 'react';
import { Settings, Shield, Clock, HelpCircle, AlertCircle } from 'lucide-react';

const USER_DECISIONS = [
  { id: 'DEC-01', title: 'Stage A Market Cap Cutoff', stage: 'Stage A', recommendation: '₹1,000 Cr minimum (Screener Small-Cap boundary)' },
  { id: 'DEC-02', title: 'Median Daily Volume / Liquidity Window', stage: 'Stage A', recommendation: '90-day median turnover > ₹50 Lakhs' },
  { id: 'DEC-03', title: 'Promoter Pledging Tolerance', stage: 'Stage A', recommendation: '0% tolerance or max 5% with strict justification' },
  { id: 'DEC-04', title: 'Minimum ROCE Threshold', stage: 'Stage A', recommendation: '15% for non-financials, 12% for utilities' },
  { id: 'DEC-05', title: 'Maximum Debt-to-Equity Boundary', stage: 'Stage A', recommendation: '0.5x for general corporates, exclude BFSI' },
  { id: 'DEC-06', title: 'Stage B Multi-Year Trend Lookback Window', stage: 'Stage B', recommendation: '5-year CAGR with 3-year minimum' },
  { id: 'DEC-07', title: 'Revenue & PAT Growth CAGR Threshold', stage: 'Stage B', recommendation: 'Sales CAGR > 10%, PAT CAGR > 12%' },
  { id: 'DEC-08', title: 'Cash Flow from Operations vs PAT Ratio', stage: 'Stage B', recommendation: 'Cumulative CFO / PAT > 0.80' },
  { id: 'DEC-09', title: 'Operating Margin Stability Band', stage: 'Stage B', recommendation: 'Standard deviation < 300 bps over 5 years' },
  { id: 'DEC-10', title: 'Stage C Economic Moat Passing Threshold', stage: 'Stage C', recommendation: 'Score >= 70 out of 100' },
  { id: 'DEC-11', title: 'Stage D Valuation Margin of Safety (MOS)', stage: 'Stage D', recommendation: '20% discount to intrinsic DCF / Multiple value' },
  { id: 'DEC-12', title: 'Stage D PEG Ratio Fallback Rule', stage: 'Stage D', recommendation: 'Fallback to 3-year historical median P/E if PEG unavailable' },
  { id: 'DEC-13', title: 'Stage E Pivot Confirmation Definition', stage: 'Stage E', recommendation: 'Breakout above 50-day EMA with volume > 1.5x' },
  { id: 'DEC-14', title: 'Stage E Stop-Loss Anchor Rule', stage: 'Stage E', recommendation: 'Recent swing low or max 7% below entry' },
  { id: 'DEC-15', title: 'Stage F Max Single Stock Allocation Cap', stage: 'Stage F', recommendation: '15% maximum portfolio weight per position' },
  { id: 'DEC-16', title: 'Stage F Max Sector Concentration Cap', stage: 'Stage F', recommendation: '25% maximum portfolio weight per sector' },
  { id: 'DEC-17', title: 'Stage F Cash Buffer Floor', stage: 'Stage F', recommendation: '15% minimum cash or liquid debt reserve' },
  { id: 'DEC-18', title: 'Stage G Trailing Stop Adjustment Frequency', stage: 'Stage G', recommendation: 'Weekly recalculation after market close' },
  { id: 'DEC-19', title: 'Quarterly Audit Result Tolerance Window', stage: 'Stage G', recommendation: '48 hours post-earnings release' },
  { id: 'DEC-20', title: 'Hard Red Flag Non-Bypass Enforcement', stage: 'Governance', recommendation: 'Strict zero-tolerance, automated block' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Workstation Settings & Financial Policy Governance
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Workstation operational profile • Financial policy decisions register • Worker task intervals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Profile */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Workstation Runtime Profile</span>
          </h2>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Mode</span>
              <span className="text-emerald-400 font-bold">Personal Workstation (Single Owner)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Market Coverage</span>
              <span className="text-slate-200 font-bold">NSE / BSE Equities</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Core Calculation Engine</span>
              <span className="text-slate-200">packages/core (Pure TypeScript / Decimal.js)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Worker Queue Engine</span>
              <span className="text-slate-200">pg-boss (PostgreSQL transactional queues)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">LLM Decision Boundary</span>
              <span className="text-cyan-400 font-bold">Summarization only; zero financial decisions</span>
            </div>
          </div>
        </div>

        {/* Governance Notice */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>20 User Policy Decisions Status</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            In accordance with Stokiffy Phase 1A governance, all 20 investment policy decisions remain strictly{' '}
            <strong className="text-amber-300">PENDING USER DECISION</strong>.
            Financial thresholds are configurable parameters and are not hardcoded into application business logic.
          </p>
          <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded text-xs text-amber-200 font-mono">
            Status: 20 Tracked • 0 Approved • Decisions Isolated in Strategy Registry
          </div>
        </div>
      </div>

      {/* 20 Decisions Table */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-200">
            Canonical 20-Decision Financial Governance Register
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-4">ID</th>
                <th className="py-2.5 px-4">Policy Item</th>
                <th className="py-2.5 px-4">Stage</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Architectural Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {USER_DECISIONS.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-cyan-400">{d.id}</td>
                  <td className="py-2.5 px-4 text-slate-200 font-sans font-medium">{d.title}</td>
                  <td className="py-2.5 px-4 text-slate-400">{d.stage}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                      PENDING USER DECISION
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 font-sans text-xs">{d.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
