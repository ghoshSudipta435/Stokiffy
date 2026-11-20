'use client';

import React, { useState } from 'react';
import { BookOpen, Plus, Tag, Calendar } from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

const JOURNAL_ENTRIES = [
  {
    id: 'jrn_01',
    symbol: 'TCS',
    title: 'Q2 FY25 Post-Earnings Audit & Moat Durability Confirmation',
    date: '2026-10-15',
    category: 'QUARTERLY_REVIEW',
    thesis: 'Strong order book book-to-bill ratio of 1.2x. Free cash flow conversion at 98% of PAT. Margin stability maintained above 26%.',
    lessons: 'Reiterating position sizing limit of 15%. Trailing stop adjusted upwards to ₹3,880.',
  },
  {
    id: 'jrn_02',
    symbol: 'RELIANCE',
    title: 'Warning Flag Logged: Subsidiary Debt Spike',
    date: '2026-10-02',
    category: 'GOVERNANCE_AUDIT',
    thesis: 'Consolidated debt rose 18% YoY driven by telecom infrastructure capex. Warning flag triggered in Stage A audit.',
    lessons: 'No new allocations permitted until consolidated net debt to EBITDA cools below 2.0x threshold.',
  },
];

export default function JournalPage() {
  const [entries, setEntries] = useState(JOURNAL_ENTRIES);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Investment Decision Journal & Post-Mortem Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable decision log • Thesis tracking • Behavioral audit & quarterly reviews.
          </p>
        </div>

        <button
          onClick={() => alert('New Journal entry modal')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Journal Entry</span>
        </button>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-bold text-xs">
                  {entry.symbol}
                </span>
                <h2 className="text-sm font-bold text-slate-200">{entry.title}</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateIST(entry.date)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                  {entry.category}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800/80 leading-relaxed">
              <div className="font-semibold text-slate-400 mb-1">Investment Thesis:</div>
              {entry.thesis}
            </div>

            <div className="text-xs text-amber-300/90 bg-amber-950/20 p-3 rounded border border-amber-800/40 leading-relaxed">
              <div className="font-semibold text-amber-400 mb-1">Post-Mortem / Behavioral Rules:</div>
              {entry.lessons}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
