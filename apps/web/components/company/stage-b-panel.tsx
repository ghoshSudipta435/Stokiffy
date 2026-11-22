'use client';

import React, { useState } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { StageBRunResponse } from '@/app/api/v1/analyses/stage-b/route';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatDateTimeIST } from '@/lib/formatters';
import { FundamentalTrendChart } from '@/components/charts/fundamental-trend-chart';
import { useCompanyFinancials } from '@/hooks/use-manual-data';

interface StageBPanelProps {
  symbol: string;
  companyId: string;
  sector: string;
  latestRun?: StageBRunResponse | null;
  onRunComplete?: () => void;
}

type RuleStatus =
  | 'PASS'
  | 'HARD_STOP'
  | 'CONDITIONAL_WARNING'
  | 'DATA_QUALITY_WARNING'
  | 'UNSUITABLE_FOR_SECTOR';

function statusColor(status: RuleStatus) {
  switch (status) {
    case 'PASS':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'HARD_STOP':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'CONDITIONAL_WARNING':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'DATA_QUALITY_WARNING':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    case 'UNSUITABLE_FOR_SECTOR':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  }
}

export function StageBPanel({
  symbol,
  companyId,
  sector,
  latestRun,
  onRunComplete,
}: StageBPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StageBRunResponse | null>(latestRun ?? null);
  const { data: financials, isLoading: financialsLoading } = useCompanyFinancials(companyId);

  const maxScore = runResult?.maxPoints ?? 10;
  const gatePassed = runResult?.gatePassed ?? false;
  const canProceed = runResult?.canProceedToStageC ?? false;
  const hardFlags = runResult?.hardStopCount ?? 0;

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await apiClient.post<StageBRunResponse>('/api/v1/analyses/stage-b', {
        companyId,
        symbol,
      });
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
            Stage B: Deep Trend Analysis
          </h2>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
            10 blocks (10-pt)
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Quarterly YoY growth, 5Y annual trends, cash-flow forensics, working-capital efficiency,
          capital productivity, and institutional shareholding.
        </p>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Running Stage B...' : 'Run Stage B Trend Analysis'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stage B Summary Header */}
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Stage B: Deep Trend Analysis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gate{' '}
              {gatePassed ? (
                <span className="text-emerald-400">PASSED — Eligible for Stage C</span>
              ) : (
                <span className="text-red-400">BLOCKED — Hard flags present</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge
              verdict={gatePassed ? 'PASSED' : 'BLOCKED'}
              score={runResult.totalPoints}
              maxScore={maxScore}
              size="lg"
            />
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getVerdictColor(runResult.verdictBand)}`}>
              {runResult.verdictBand}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Score</div>
            <div className="text-xl font-mono font-bold text-slate-100">
              {runResult.totalPoints} / {maxScore}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Min pass: {runResult.minPassScore}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Gate</div>
            <div className={`text-xs font-mono font-semibold ${gatePassed ? 'text-emerald-400' : 'text-red-400'}`}>
              {gatePassed ? 'PASSED' : 'BLOCKED'}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Hard Flags</div>
            <div className={`text-xs font-mono font-semibold ${hardFlags > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {hardFlags}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Stage C</div>
            <div className={`text-xs font-mono font-semibold ${canProceed ? 'text-emerald-400' : 'text-red-400'}`}>
              {canProceed ? 'ELIGIBLE' : 'BLOCKED'}
            </div>
          </div>
        </div>

        {runResult.forensicFlags.length > 0 && (
          <div className="mt-4 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
            Forensic warnings: {runResult.forensicFlags.join(', ')}
          </div>
        )}

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
            {isRunning ? 'Re-running...' : 'Run / Re-run Stage B'}
          </button>
          <span className="text-xs text-slate-500">
            Last run: {formatDateTimeIST(runResult.analysisRunId && 'now')}
          </span>
        </div>
      </div>

      {/* Fundamental Trend Chart */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-3">
          {financialsLoading ? (
            <div className="h-[340px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : (
            <FundamentalTrendChart financials={financials ?? []} height={340} />
          )}
        </div>
      </div>

      {/* 10-Block Deep Trend Table */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Deep Trend Analysis — 10 Blocks
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Trend classification, points awarded, and forensic warnings per block.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Block</th>
                <th className="py-3 px-4 text-right">Pts</th>
                <th className="py-3 px-4 text-right">Max</th>
                <th className="py-3 px-4 text-center">Trend</th>
                <th className="py-3 px-4">Explanation</th>
                <th className="py-3 px-4 text-center">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {runResult.breakdown.map((rule) => (
                <tr key={rule.ruleKey} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {rule.ruleKey.replace(/STAGE_B_/, '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    {rule.points}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    {rule.maxPoints}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${statusColor(rule.status as RuleStatus)}`}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {rule.explanation}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {rule.flags.length > 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        {rule.flags.map((f) => (
                          <RedFlagIndicator
                            key={f.code}
                            severity={f.severity}
                            code={f.code}
                            title={f.message}
                            status={f.status}
                            compact
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">—</span>
                    )}
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

function getVerdictColor(band: string | undefined) {
  switch (band) {
    case 'EXCEPTIONAL':
    case 'EXCELLENT':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'GOOD':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'AVOID':
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}
