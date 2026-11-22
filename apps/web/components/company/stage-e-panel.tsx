'use client';

import React, { useState } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  TrendingUp,
  Activity,
  FileText,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { StageERunResponse } from '@/app/api/v1/analyses/stage-e/route';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatINR, formatPercent } from '@/lib/formatters';
import { CandlestickChart } from '@/components/charts/candlestick-chart';
import { usePriceBars } from '@/hooks/use-manual-data';
import { useSyncOhlcv } from '@/hooks/use-market-data';
import { ImportOHLCVModal } from '@/components/company/import-ohlcv-modal';

interface StageEPanelProps {
  symbol: string;
  companyId: string;
  sector: string;
  latestRun?: StageERunResponse | null;
  onRunComplete?: () => void;
}

interface RunStageEVars {
  valuationMaxBuyPrice?: number;
  targetPrice?: number;
  minRiskReward?: number;
  buyZoneTolerancePct?: number;
}

const DEFAULT_VARS: RunStageEVars = {
  valuationMaxBuyPrice: undefined,
  targetPrice: undefined,
  minRiskReward: undefined,
  buyZoneTolerancePct: undefined,
};

function setupQualityColor(q: string) {
  switch (q) {
    case 'A+':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'A':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'B':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'C':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

export function StageEPanel({
  symbol,
  companyId,
  sector,
  latestRun,
  onRunComplete,
}: StageEPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StageERunResponse | null>(latestRun ?? null);
  const [vars, setVars] = useState<RunStageEVars>({ ...DEFAULT_VARS });
  const [importOpen, setImportOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    syncedCount: number;
    latestPrice: number | null;
    latestDate: string | null;
    yahooSymbol: string;
  } | null>(null);

  const { data: priceBars, isLoading: priceBarsLoading } = usePriceBars(companyId);
  const syncOhlcv = useSyncOhlcv();

  const handleSyncPrices = async () => {
    try {
      const result = await syncOhlcv.mutateAsync({
        companyId,
        symbol,
        days: 365,
      });
      setSyncResult(result);
    } catch {
      // Error handled by API route / banner could be added
    }
  };

  const eligible = runResult?.eligible ?? false;
  const gatePassed = runResult?.gatePassed ?? false;
  const canProceed = runResult?.canProceedToStageF ?? false;
  const inBuyZone = runResult?.inBuyZone ?? false;
  const setupQuality = runResult?.bestSetup?.setupQuality ?? '—';

  const tc = runResult?.technicalContext;
  const currentPrice = runResult?.currentPrice ?? 0;
  const supports = tc?.keyLevels.support ?? [];
  const resistances = tc?.keyLevels.resistance ?? [];
  const nearestSupport =
    supports.filter((s) => s <= currentPrice).sort((a, b) => b - a)[0] ?? null;
  const nearestResistance =
    resistances.filter((r) => r >= currentPrice).sort((a, b) => a - b)[0] ?? null;

  const referenceLines: Array<{
    price: number;
    color: string;
    label: string;
    lineStyle: 0 | 1 | 2;
  }> = [];
  if (runResult?.maxBuyPrice != null && runResult.maxBuyPrice > 0) {
    referenceLines.push({
      price: runResult.maxBuyPrice,
      color: '#22c55e',
      label: 'Max Buy (20% MOS)',
      lineStyle: 2,
    });
  }
  if (nearestSupport != null) {
    referenceLines.push({
      price: nearestSupport,
      color: '#22c55e',
      label: 'Support',
      lineStyle: 2,
    });
  }
  if (nearestResistance != null) {
    referenceLines.push({
      price: nearestResistance,
      color: '#f59e0b',
      label: 'Resistance',
      lineStyle: 2,
    });
  }
  if (runResult?.bestSetup?.invalidationLevel) {
    referenceLines.push({
      price: runResult.bestSetup.invalidationLevel,
      color: '#ef4444',
      label: 'Stop-Loss',
      lineStyle: 2,
    });
  }

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await apiClient.post<StageERunResponse>('/api/v1/analyses/stage-e', {
        companyId,
        symbol,
        valuationMaxBuyPrice: vars.valuationMaxBuyPrice,
        targetPrice: vars.targetPrice,
        minRiskReward: vars.minRiskReward,
        buyZoneTolerancePct: vars.buyZoneTolerancePct,
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

  return (
    <div className="space-y-6">
      {!runResult ? (
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Stage E: Technical Entry & Timing
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
              Candlestick + Technicals
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Technical entry analysis: trend, candlestick patterns, entry zone, invalidation
            level and risk/reward. Defaults valuation max buy price from latest Stage D.
          </p>

          <div className="space-y-3">
            {[
              { label: 'Max Buy Price Override', key: 'valuationMaxBuyPrice', placeholder: 'optional' },
              { label: 'Target Price', key: 'targetPrice', placeholder: 'optional' },
              { label: 'Min Risk:Reward', key: 'minRiskReward', placeholder: '1.5' },
              { label: 'Buy Zone Tolerance (%)', key: 'buyZoneTolerancePct', placeholder: 'optional' },
            ].map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <span className="w-24 text-[10px] text-slate-400 font-mono">{field.label}</span>
                <input
                  value={(vars[field.key as keyof RunStageEVars] ?? '').toString()}
                  onChange={(e) =>
                    setVars((prev) => ({ ...prev, [field.key]: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  placeholder={field.placeholder}
                  className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            {isRunning ? 'Analyzing...' : 'Run Technical Analysis'}
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Patterns are candidates requiring context and confirmation before entry.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors border border-slate-600"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import OHLCV CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Stage E: Technical Entry & Timing
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gate{' '}
                {gatePassed ? (
                  <span className="text-emerald-400">ELIGIBLE for Stage F</span>
                ) : (
                  <span className="text-red-400">BLOCKED — Entry Not Qualified</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ScoreBadge
                verdict={gatePassed ? 'PASSED' : 'BLOCKED'}
                score={runResult.totalPoints}
                maxScore={runResult.maxPoints}
                size="lg"
              />
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${setupQualityColor(setupQuality)}`}>
                Setup {setupQuality}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Entry Eligibility</div>
              <div className={`text-xs font-mono font-semibold ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>
                {eligible ? 'ELIGIBLE' : 'BLOCKED'}
              </div>
            </div>
            <div className="p-4 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Buy Zone</div>
              <div className={`text-xs font-mono font-semibold ${inBuyZone ? 'text-emerald-400' : 'text-red-400'}`}>
                {inBuyZone ? 'IN ZONE' : 'OUTSIDE'}
              </div>
            </div>
            <div className="p-4 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Current Price</div>
              <div className="text-xs font-mono font-bold text-slate-100">
                {formatINR(currentPrice)}
              </div>
            </div>
            <div className="p-4 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Stage F</div>
              <div className={`text-xs font-mono font-semibold ${canProceed ? 'text-emerald-400' : 'text-red-400'}`}>
                {canProceed ? 'ELIGIBLE' : 'BLOCKED'}
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
                <Activity className="w-3 h-3.5" />
              )}
              {isRunning ? 'Re-running...' : 'Run / Re-run Technicals'}
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors border border-slate-600"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import OHLCV CSV
            </button>
            <button
              onClick={handleSyncPrices}
              disabled={syncOhlcv.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors border border-slate-600"
            >
              {syncOhlcv.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Sync Prices (Yahoo)
            </button>
            <span className="text-xs text-slate-500">
              Last run: {runResult.analysisRunId && 'now'}
            </span>
          </div>

          {syncResult && (
            <div className="mt-3 p-3 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Synced {syncResult.syncedCount} daily bar{syncResult.syncedCount !== 1 ? 's' : ''}
                — latest ₹{syncResult.latestPrice?.toFixed(0) ?? '—'}
                ({syncResult.yahooSymbol})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Candlestick Chart */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Price Chart
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono ${
              priceBarsLoading || !priceBars
                ? 'bg-slate-800 text-slate-400 animate-pulse'
                : priceBars.length > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }">
              {priceBars?.length ?? 0} bars
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Daily OHLCV with reference levels
          </span>
        </div>
        <div className="p-3">
          {priceBarsLoading ? (
            <div className="h-[320px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : (
            <CandlestickChart
              priceBars={priceBars ?? []}
              referenceLines={referenceLines}
              height={320}
            />
          )}
        </div>
      </div>

      {runResult && (
        <>
          {/* Technical Context Summary */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Technical Context
              </h3>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Daily Trend</div>
                <div className="text-xs font-mono text-slate-200 capitalize">
                  {tc?.dailyTrend ?? '—'}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">SMA 20 / 50 / 200</div>
                <div className="text-xs font-mono text-slate-200">
                  {tc?.sma20?.toFixed(2) ?? '—'} /{' '}
                  {tc?.sma50?.toFixed(2) ?? '—'} /{' '}
                  {tc?.sma200?.toFixed(2) ?? '—'}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">ATR(14)</div>
                <div className="text-xs font-mono text-slate-200">{tc?.atr14?.toFixed(2) ?? '—'}</div>
              </div>
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Volume Ratio</div>
                <div className="text-xs font-mono text-slate-200">{tc?.volumeRatio?.toFixed(2) ?? '—'}x</div>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-slate-800">
              <div className="flex gap-4 text-[10px] text-slate-400 font-mono">
                <span>
                  Support: {(tc?.keyLevels.support ?? []).map((s) => s.toFixed(0)).join(', ') || '—'}
                </span>
                <span>
                  Resistance: {(tc?.keyLevels.resistance ?? []).map((r) => r.toFixed(0)).join(', ') || '—'}
                </span>
                <span>Volume: {tc?.volumeProfile ?? '—'}</span>
                <span>RS: {tc?.rsVsBenchmark ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Detected Candlestick Patterns */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Detected Candlestick Patterns
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Patterns are candidates requiring context and confirmation before entry.
              </p>
            </div>
            <div className="divide-y divide-slate-800/60">
              {runResult.setups.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-xs">
                  No confirmed candlestick patterns detected in recent lookback.
                </div>
              ) : (
                runResult.setups.map((s) => (
                  <div key={s.pattern} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-200">{s.pattern}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                          s.pattern.includes('bullish') || s.pattern.includes('hammer') || s.pattern.includes('morning') || s.pattern.includes('dragonfly') || s.pattern.includes('soldiers')
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {s.pattern.includes('bearish') || s.pattern.includes('shooting') || s.pattern.includes('evening')
                            ? 'BEARISH'
                            : 'BULLISH'}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                        s.inBuyZone ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {s.inBuyZone ? 'IN BUY ZONE' : 'OUTSIDE ZONE'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 mb-1">
                      Entry {formatINR(s.entryZone.low)} – {formatINR(s.entryZone.high)} •{' '}
                      Stop {formatINR(s.stopLoss)} • R:R {s.riskReward.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Setup {s.setupQuality}</span>
                      <span>Context {s.contextScore}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Entry Setup & Risk/Reward Card */}
          {runResult.bestSetup && (
            <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Entry Setup & Risk/Reward
                </h3>
              </div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Entry Zone</div>
                  <div className="text-xs font-mono text-slate-200">
                    {formatINR(runResult.bestSetup.entryZone.low)} – {formatINR(runResult.bestSetup.entryZone.high)}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Invalidation / Stop</div>
                  <div className="text-xs font-mono text-red-400">{formatINR(runResult.bestSetup.invalidationLevel)}</div>
                </div>
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Target(s)</div>
                  <div className="text-xs font-mono text-emerald-400">
                    {runResult.bestSetup.targets.map((t) => formatINR(t)).join(', ')}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Risk:Reward</div>
                  <div className={`text-xs font-mono font-bold ${runResult.bestSetup.riskReward >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {runResult.bestSetup.riskReward.toFixed(2)}:1
                  </div>
                </div>
              </div>
              <p className="px-3 py-2 text-[10px] text-slate-500">
                Enter within the zone, invalidate below {formatINR(runResult.bestSetup.invalidationLevel)}.
                Patterns require confirmation — do not enter on pattern alone.
              </p>
            </div>
          )}
        </>
      )}

      <ImportOHLCVModal
        isOpen={importOpen}
        companyId={companyId}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
        }}
      />
    </div>
  );
}
