'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  Layers,
  FileCode,
} from 'lucide-react';
import { useCompany } from '@/hooks/use-company';
import { ScoreBadge } from '@/components/shared/score-badge';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = String(params.symbol || 'TCS').toUpperCase();
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  const { data: company, isLoading, error } = useCompany(symbol);

  const handleTestProbe = async () => {
    try {
      const res = await fetch('/api/v1/analyses/stage-a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id || symbol }),
      });
      const data = await res.json();
      if (res.ok) {
        setProbeMessage(
          `Probe Response: ${data.data.message} Status: ${data.data.status}.`
        );
      }
    } catch {
      setProbeMessage('Probe request failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        Loading demonstration fixture for {symbol}...
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-slate-100 mb-2">Company Fixture Not Found</h2>
        <p className="text-xs text-slate-400 mb-4">
          No tracked fixture found for ticker &apos;{symbol}&apos;.
        </p>
        <Link
          href="/screener"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
        >
          Return to Screener
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-cyan-400">{company.symbol}</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                {company.exchange}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                ISIN: {company.isin}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                DEMO FIXTURE
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">
              {company.name} • <span className="text-slate-400">{company.sector} / {company.industry}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestProbe}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors border border-slate-700"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            <span>Test Stage A API Interface</span>
          </button>
        </div>
      </div>

      {probeMessage && (
        <div className="p-3 bg-slate-900 border border-cyan-800/60 rounded text-cyan-200 text-xs flex items-center justify-between">
          <span>{probeMessage}</span>
          <button onClick={() => setProbeMessage(null)} className="text-xs text-cyan-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Scope Notice */}
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Deterministic Engine & Domain Separation Notice:</strong>
          <p className="mt-1 text-slate-400 leading-relaxed">
            Financial calculations, valuation models, and stage progression logic reside strictly in <code className="text-cyan-400">packages/core</code>.
            In Phase 1A, all stage verdicts are displayed as <strong className="text-amber-400 font-mono">PENDING</strong>.
            No fabricated scores, ratios, or pass/fail decisions are generated in this workstation interface.
          </p>
        </div>
      </div>

      {/* 7-Stage Status Progression Ribbon (Neutral Status) */}
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          7-Stage Lifecycle Evaluation Status
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: 'Stage A: Screen', status: 'PENDING' },
            { label: 'Stage B: Trend', status: 'PENDING' },
            { label: 'Stage C: Moat', status: 'PENDING' },
            { label: 'Stage D: Valuation', status: 'PENDING' },
            { label: 'Stage E: Entry', status: 'PENDING' },
            { label: 'Stage F: Buy Plan', status: 'PENDING' },
            { label: 'Stage G: Monitor', status: 'PENDING' },
          ].map((item) => (
            <div key={item.label} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 font-mono">{item.label}</div>
              <div className="mt-1">
                <ScoreBadge verdict="PENDING" size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Status Panel */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">
          Domain Engine & Database Integration Surface
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Real equity financial statements (income statements, balance sheets, cash flow statements),
          calculated ratios (ROCE, ROE, P/E, D/E), and audit flags will be bound to this workstation in Phase 1B
          via <code className="text-cyan-400">packages/db</code> (Prisma client) and <code className="text-cyan-400">packages/core</code> (pure TypeScript calculation engines).
        </p>

        <div className="p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-400 space-y-2">
          <div className="flex justify-between">
            <span>Database Integration:</span>
            <span className="text-amber-400">Awaiting Phase 1B</span>
          </div>
          <div className="flex justify-between">
            <span>Core Calculation Engine:</span>
            <span className="text-amber-400">packages/core (Separated)</span>
          </div>
          <div className="flex justify-between">
            <span>Financial Policies:</span>
            <span className="text-amber-400">20 Decisions Pending User Approval</span>
          </div>
        </div>
      </div>
    </div>
  );
}
