'use client';

import React, { useState } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { StageARunResponse } from '@/app/api/v1/analyses/stage-a/route';
import type { RedFlagDTO } from '@/app/api/v1/flags/route';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatDateTimeIST, formatPercent, formatRatio } from '@/lib/formatters';

interface StageAPanelProps {
  symbol: string;
  companyId: string;
  sector: string;
  latestRun?: StageARunResponse | null;
  onRunComplete?: () => void;
}

type RuleStatusColor = 'PASS' | 'HARD_STOP' | 'CONDITIONAL_WARNING' | 'DATA_QUALITY_WARNING' | 'UNSUITABLE_FOR_SECTOR';

function statusColor(status: RuleStatusColor) {
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

export function StageAPanel({
  symbol,
  companyId,
  sector,
  latestRun,
  onRunComplete,
}: StageAPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StageARunResponse | null>(latestRun ?? null);
  const [isBankVariant, setIsBankVariant] = useState(false);

  const maxScore = runResult?.maxPoints ?? 10;
  const isBank = sector.toLowerCase().includes('bank') || sector.toLowerCase().includes('nbfc');

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await apiClient.post<StageARunResponse>('/api/v1/analyses/stage-a', {
        companyId,
        symbol,
      });
      const data = response.data;
      setRunResult(data);
      setIsBankVariant(data.bankVariant);
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
            Stage A: Quick Screening
          </h2>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
            {isBank ? 'Bank/NBFC (9-pt)' : 'Non-Financial (10-pt)'}
          </span>
        </div>
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
          {isRunning ? 'Running Stage A...' : 'Run Stage A Screening'}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Executes the 10-check quick screen and persists results to PostgreSQL.
        </p>
      </div>
    );
  }

  const gatePassed = runResult.gatePassed ?? false;
  const canProceed = runResult.canProceedToStageB ?? false;
  const hardFlags = runResult.hardStopCount;

  return (
    <div className="space-y-6">
      {/* Stage A Summary Header */}
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Stage A: Quick Screening
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gate{' '}
              {gatePassed ? (
                <span className="text-emerald-400">PASSED — Eligible for Stage B</span>
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
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Stage B</div>
            <div className={`text-xs font-mono font-semibold ${canProceed ? 'text-emerald-400' : 'text-red-400'}`}>
              {canProceed ? 'ELIGIBLE' : 'BLOCKED'}
            </div>
          </div>
        </div>

        {isBank && (
          <div className="mt-4 p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 inline mr-1.5" />
            Bank/NBFC legacy mode active (9-point scale). Current ratio and interest coverage rules are unsuitable for this sector.
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
            {isRunning ? 'Re-running...' : 'Run / Re-run Stage A'}
          </button>
          <span className="text-xs text-slate-500">
            Last run: {formatDateTimeIST(runResult.analysisRunId && 'now')}
          </span>
        </div>
      </div>

      {/* 10-Check Explainability Table */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            10-Check Explainability Breakdown
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Points awarded per metric, with status and explanation from the scoring engine.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Check</th>
                <th className="py-3 px-4 text-right">Pts</th>
                <th className="py-3 px-4 text-right">Max</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Explanation</th>
                <th className="py-3 px-4 text-center">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {runResult.breakdown.map((rule) => (
                <tr key={rule.ruleKey} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-200">
                    {rule.ruleKey.replace(/STAGE_A_/, '').replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    {rule.points}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">
                    {rule.maxPoints}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${statusColor(rule.status as RuleStatusColor)}`}>
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
