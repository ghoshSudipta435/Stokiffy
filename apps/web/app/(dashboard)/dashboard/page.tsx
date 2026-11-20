'use client';

import React from 'react';
import Link from 'next/link';
import {
  Layers,
  Filter,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { FinancialMetric } from '@/components/shared/financial-metric';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';

export default function DashboardPage() {
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

      {/* System Technical Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialMetric
          label="Workstation Profile"
          value="Personal Mode"
          subValue="Single Owner (Local Station)"
        />
        <FinancialMetric
          label="Core Engine Boundary"
          value="packages/core"
          subValue="Pure TypeScript & Decimal.js"
        />
        <FinancialMetric
          label="Worker Queue Engine"
          value="pg-boss"
          subValue="PostgreSQL Background Queues"
        />
        <FinancialMetric
          label="Governance Register"
          value="20 Decisions"
          subValue="Status: Pending User Approval"
        />
      </div>

      {/* 7-Stage Funnel Overview (Neutral Status) */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">
              7-Stage Investment Lifecycle Architecture
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic progression lifecycle. Engines pending core integration and policy approval.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">Modular Monolith</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          {[
            { stage: 'Stage A', name: 'Quick Screen', status: 'Pending Core' },
            { stage: 'Stage B', name: 'Deep Trend', status: 'Pending Core' },
            { stage: 'Stage C', name: 'Moat & Governance', status: 'Pending Core' },
            { stage: 'Stage D', name: 'Valuation', status: 'Pending Core' },
            { stage: 'Stage E', name: 'Tech Entry', status: 'Pending Core' },
            { stage: 'Stage F', name: 'Buy Plan', status: 'Pending Core' },
            { stage: 'Stage G', name: 'Monitoring', status: 'Pending Core' },
          ].map((item) => (
            <div
              key={item.stage}
              className="p-3 rounded-md bg-slate-950/80 border border-slate-800"
            >
              <div className="text-[10px] font-mono text-cyan-400/90 font-bold uppercase">
                {item.stage}
              </div>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                {item.name}
              </div>
              <div className="text-[10px] font-mono text-amber-400/90 mt-2 px-1 py-0.5 rounded bg-slate-900 border border-slate-800 truncate">
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demonstration Universe Table */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">
              Tracked Equity Fixtures (Demonstration Layout)
            </h2>
            <p className="text-xs text-slate-400">
              Layout verification table. Real company data will be populated from packages/db in Phase 1B.
            </p>
          </div>
          <Link
            href="/screener"
            className="text-xs font-medium text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            <span>Open Screener</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Company Name</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3 text-center">Stage A Status</th>
                <th className="py-2.5 px-3 text-center">Engine Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-bold text-cyan-400">
                  <Link href="/companies/TCS" className="hover:underline">
                    TCS
                  </Link>
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-300">
                  Tata Consultancy Services Ltd. [DEMO]
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Information Technology</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                    NOT_EVALUATED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-amber-400 text-[10px]">
                  PENDING_INTEGRATION
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-bold text-cyan-400">
                  <Link href="/companies/INFY" className="hover:underline">
                    INFY
                  </Link>
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-300">
                  Infosys Limited [DEMO]
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Information Technology</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                    NOT_EVALUATED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-amber-400 text-[10px]">
                  PENDING_INTEGRATION
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-bold text-cyan-400">
                  <Link href="/companies/TITAN" className="hover:underline">
                    TITAN
                  </Link>
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-300">
                  Titan Company Limited [DEMO]
                </td>
                <td className="py-2.5 px-3 font-sans text-slate-400">Consumer Discretionary</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                    NOT_EVALUATED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-amber-400 text-[10px]">
                  PENDING_INTEGRATION
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
