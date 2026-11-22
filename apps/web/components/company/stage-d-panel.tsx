'use client';

import React, { useState } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Calculator,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { StageDRunResponse } from '@/app/api/v1/companies/[id]/valuations/route';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatINR } from '@/lib/formatters';

interface StageDPanelProps {
  symbol: string;
  companyId: string;
  sector: string;
  latestRun?: StageDRunResponse | null;
  onRunComplete?: () => void;
}

const DEFAULT_ASSUMPTIONS = {
  selectedFairPE: '',
  selectedFairPB: '',
  assumedExitPE: '',
  discountRate: '10',
  terminalGrowthRate: '3',
  marginOfSafetyPct: '20',
  primaryMethod: 'DCF' as 'PE' | 'PEG' | 'PB' | 'DCF',
};

function methodColor(applicability: string) {
  switch (applicability) {
    case 'suitable':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'limited':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'unsuitable':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

export function StageDPanel({
  symbol,
  companyId,
  sector,
  latestRun,
  onRunComplete,
}: StageDPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StageDRunResponse | null>(latestRun ?? null);

  // Assumption form state
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS });

  const buyReady = runResult?.buyReady ?? false;
  const canProceed = runResult?.canProceedToStageE ?? false;
  const mosPct = runResult?.marginOfSafetyPct ?? 0;
  const confidence = runResult?.overallConfidence ?? 'low';

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await apiClient.post<StageDRunResponse>(
        `/api/v1/companies/${encodeURIComponent(companyId)}/valuations`,
        {
          symbol,
          marketPrice: undefined,
          selectedFairPE: assumptions.selectedFairPE
            ? Number(assumptions.selectedFairPE)
            : undefined,
          selectedFairPB: assumptions.selectedFairPB
            ? Number(assumptions.selectedFairPB)
            : undefined,
          assumedExitPE: assumptions.assumedExitPE
            ? Number(assumptions.assumedExitPE)
            : undefined,
          discountRate: assumptions.discountRate
            ? Number(assumptions.discountRate) / 100
            : undefined,
          terminalGrowthRate: assumptions.terminalGrowthRate
            ? Number(assumptions.terminalGrowthRate) / 100
            : undefined,
          marginOfSafetyPct: assumptions.marginOfSafetyPct
            ? Number(assumptions.marginOfSafetyPct) / 100
            : undefined,
          primaryMethod: assumptions.primaryMethod,
        }
      );
      const data = response.data;
      setRunResult(data);
      onRunComplete?.();
    } catch {
      // Error handled by API route
    } finally {
      setIsRunning(false);
    }
  };

  if (!runResult) {
    return (
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Stage D: Valuation
          </h2>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
            4 methods (PE/PEG/PB/DCF)
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Intrinsic valuation via P/E, PEG, P/B and simplified DCF. Computes fair value,
          valuation range, max buy price (20% margin of safety) and buy-readiness for Stage E.
        </p>

        <div className="space-y-3">
          {[
            { label: 'Fair P/E', key: 'selectedFairPE', placeholder: 'e.g. 25' },
            { label: 'Fair P/B', key: 'selectedFairPB', placeholder: 'e.g. 5' },
            { label: 'Assumed Exit P/E', key: 'assumedExitPE', placeholder: 'optional' },
            { label: 'WACC / Discount Rate (%)', key: 'discountRate', placeholder: '10' },
            { label: 'Terminal Growth (%)', key: 'terminalGrowthRate', placeholder: '3' },
            { label: 'Margin of Safety (%)', key: 'marginOfSafetyPct', placeholder: '20' },
          ].map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <span className="w-20 text-[10px] text-slate-400 font-mono">{field.label}</span>
              <input
                value={assumptions[field.key as keyof typeof assumptions]}
                onChange={(e) =>
                  setAssumptions((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-20 text-[10px] text-slate-400 font-mono">Primary Method</span>
            <select
              value={assumptions.primaryMethod}
              onChange={(e) =>
                setAssumptions((prev) => ({
                  ...prev,
                  primaryMethod: e.target.value as 'PE' | 'PEG' | 'PB' | 'DCF',
                }))
              }
              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="DCF">DCF</option>
              <option value="PE">P/E</option>
              <option value="PEG">PEG</option>
              <option value="PB">P/B</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Valuating...' : 'Run Valuation'}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Adjust assumptions above, then run. Results persist to PostgreSQL.
        </p>
      </div>
    );
  }

  const methodResults = runResult.methods;
  const primaryMethod = methodResults.find((m) => m.method === runResult.primaryMethod);

  return (
    <div className="space-y-6">
      {/* Valuation Summary Header */}
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Stage D: Valuation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gate{' '}
              {buyReady ? (
                <span className="text-emerald-400">BUY-READY — Eligible for Stage E</span>
              ) : (
                <span className="text-red-400">NOT BUY-READY — Stage E Blocked</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge
              verdict={buyReady ? 'PASSED' : 'BLOCKED'}
              score={runResult.totalPoints}
              maxScore={runResult.maxPoints}
              size="lg"
            />
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getConfidenceColor(confidence)}`}>
              {confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Fair Value</div>
            <div className="text-xl font-mono font-bold text-slate-100">
              {formatINR(runResult.selectedFairValue)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Primary: {runResult.primaryMethod}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Valuation Range</div>
            <div className="text-xl font-mono font-bold text-slate-100">
              {formatINR(runResult.valuationRange.low)} –{' '}
              {formatINR(runResult.valuationRange.high)}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Max Buy Price (20% MOS)</div>
            <div className="text-xl font-mono font-bold text-slate-100">
              {formatINR(runResult.maxBuyPrice)}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Margin of Safety</div>
            <div className={`text-xs font-mono font-semibold ${mosPct >= 20 ? 'text-emerald-400' : 'text-red-400'}`}>
              {mosPct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors border border-slate-600"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3 h-3.5" />
            )}
            {isRunning ? 'Re-running...' : 'Run / Re-run Valuation'}
          </button>
          <span className="text-xs text-slate-500">
            Last run: {runResult.analysisRunId && 'now'}
          </span>
        </div>
      </div>

      {/* 4-Method Breakdown Cards */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Valuation Method Breakdown
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Fair value, applicability and assumptions per method.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
          {methodResults.map((m) => (
            <div
              key={m.method}
              className={`p-3 rounded border ${methodColor(m.applicability)}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-mono font-bold text-cyan-400">{m.method}</span>
                <span className={`text-[9px] font-mono ${methodColor(m.applicability)}`}>
                  {m.applicability.toUpperCase()}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-300 mb-1">
                {formatINR(m.fairValue)} fair value
              </div>
              <div className="text-[10px] text-slate-400 mb-1">{m.explanation}</div>
              <div className="text-[10px] text-slate-500">
                Confidence: {m.confidence.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DCF Scenarios & Sensitivity */}
      {primaryMethod && primaryMethod.scenarios && (
        <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              DCF Scenarios & Sensitivity
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Bear / Base / Bull fair values and WACC vs Terminal Growth matrix.
            </p>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['bear', 'base', 'bull'].map((scenario) => (
                <div key={scenario} className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-0.5">
                    {scenario.toUpperCase()}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-100">
                    {formatINR(primaryMethod.scenarios![scenario as keyof typeof primaryMethod.scenarios])}
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
                  <tr>
                    <th className="py-2 px-3">WACC \\ Terminal Growth</th>
                    {[0.02, 0.03, 0.04].map((tg) => (
                      <th key={tg} className="py-2 px-3 text-center">
                        {(tg * 100).toFixed(0)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[0.08, 0.1, 0.12].map((wacc) => (
                    <tr key={wacc}>
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {(wacc * 100).toFixed(0)}%
                      </td>
                      {[0.02, 0.03, 0.04].map((tg) => (
                        <td key={tg} className="py-2 px-3 text-center font-mono text-slate-400">
                          —
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 italic">
              Sensitivity matrix shown for illustration; recompute valuation to regenerate
              based on current WACC / terminal growth assumptions.
            </p>
          </div>
        </div>
      )}

      {/* DCF Educational Disclaimer */}
      {primaryMethod?.method === 'DCF' && (
        <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <Info className="w-3.5 h-3.5 inline mr-1.5" />
          DCF is a model-driven estimate sensitive to WACC, terminal growth and
          forecast assumptions. Not investment advice — treat as directional only.
        </div>
      )}
    </div>
  );
}

function getConfidenceColor(conf: string) {
  switch (conf) {
    case 'high':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'low':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}
