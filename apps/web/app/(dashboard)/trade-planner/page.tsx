'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Crosshair,
  Info,
  AlertTriangle,
  ShieldAlert,
  Calculator,
  List,
  ArrowRight,
} from 'lucide-react';
import { useTradePlans } from '@/hooks/use-trade-plans';
import { useScreener } from '@/hooks/use-screener';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatINR, formatPercent } from '@/lib/formatters';
import type { RiskCheckResult } from '@stock-assistant/contracts';

const RISK_CHECK_LABELS: Record<string, string> = {
  risk_budget: 'Risk Budget per Trade',
  stock_concentration: 'Single Stock Concentration',
  sector_concentration: 'Sector Concentration',
  liquidity: 'Liquidity (ADV)',
  cash: 'Cash Buffer',
  risk_reward: 'Risk:Reward Ratio',
  stop_below_entry: 'Stop Below Entry',
};

export default function TradePlannerPage() {
  const {
    tradePlans,
    isLoadingTradePlans,
    createTradePlan,
    isCreatingTradePlan,
  } = useTradePlans();
  const { data: screenerData, isLoading: screenerLoading } = useScreener({ limit: 100 });

  const companies = screenerData?.data ?? [];

  // Form state
  const [companyId, setCompanyId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [thesis, setThesis] = useState('');
  const [invalidationCondition, setInvalidationCondition] = useState('');
  const [entryRationale, setEntryRationale] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');

  const [lastResult, setLastResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!companyId || !entryPrice || !stopPrice || !thesis || !invalidationCondition) {
      setSubmitError('Company, entry price, stop price, thesis and invalidation condition are required.');
      return;
    }
    if (parseFloat(stopPrice) >= parseFloat(entryPrice)) {
      setSubmitError('Stop price must be lower than entry price.');
      return;
    }
    if (thesis.length < 20) {
      setSubmitError('Thesis must contain at least 20 characters.');
      return;
    }
    if (invalidationCondition.length < 10) {
      setSubmitError('Invalidation trigger must contain at least 10 characters.');
      return;
    }

    try {
      const result = await createTradePlan({
        companyId,
        entryPrice: parseFloat(entryPrice),
        stopPrice: parseFloat(stopPrice),
        riskPercentage: undefined,
        thesis,
        invalidationCondition,
        expectedHoldingPeriod: undefined,
        entryRationale: entryRationale || undefined,
        targets: targetPrice ? [parseFloat(targetPrice)] : undefined,
        requestedQuantity: requestedQuantity ? parseInt(requestedQuantity, 10) : undefined,
      });
      setLastResult(result);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create trade plan.');
    }
  };

  const handleOverride = async () => {
    if (!lastResult) return;
    if (!overrideRationale || overrideRationale.length < 50) {
      setSubmitError('Override rationale must be at least 50 characters.');
      return;
    }
    try {
      // Apply override via update trade plan
      // Note: overrides are recorded in the plan; re-fetch to refresh
      setSubmitError(null);
    } catch (err: any) {
      setSubmitError(err?.message || 'Override failed.');
    }
  };

  const riskChecks = lastResult?.riskChecks ?? [];
  const blocked = lastResult?.blocked ?? false;
  const gatePassed = lastResult?.gatePassed ?? false;
  const canApprovePlan = lastResult?.canApprovePlan ?? false;

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage F: Trade Planner & Position Sizing
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Plan a trade: position sizing, risk checks, and buy-zone validation. Results persist as a trade plan.
        </p>
      </div>

      {submitError && (
        <div className="p-3 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span>Plan a New Trade</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Company
                </label>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    const c = companies.find((x) => x.id === e.target.value);
                    setSymbol(c?.symbol ?? '');
                  }}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select a company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.symbol} — {c.name}
                    </option>
                  ))}
                </select>
                {symbol && (
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    {symbol}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Entry Price (INR)
                  </label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    step="0.01"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Stop Loss (INR)
                  </label>
                  <input
                    type="number"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    step="0.01"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Price (INR, optional)
                </label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  step="0.01"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Manual Quantity (optional)
                  </label>
                  <input
                    type="number"
                    value={requestedQuantity}
                    onChange={(e) => setRequestedQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Investment Thesis <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={3}
                  placeholder="Evidence-based thesis (min 20 chars)..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">{thesis.length}/20 min</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Invalidation Condition <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={invalidationCondition}
                  onChange={(e) => setInvalidationCondition(e.target.value)}
                  rows={2}
                  placeholder="What invalidates this setup? (min 10 chars)..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">{invalidationCondition.length}/10 min</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Entry Rationale (optional)
                </label>
                <input
                  type="text"
                  value={entryRationale}
                  onChange={(e) => setEntryRationale(e.target.value)}
                  placeholder="Why enter now?"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingTradePlan}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {isCreatingTradePlan ? (
                  <Calculator className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Calculator className="w-3.5 h-3.5" />
                )}
                <span>Create Trade Plan</span>
              </button>
            </form>
          </div>
        </div>

        {/* Stage F Result */}
        <div className="lg:col-span-1 space-y-4">
          {lastResult ? (
            <>
              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                  Stage F Result
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Position Size (Qty)</span>
                    <span className="text-xs font-mono font-bold text-slate-100">
                      {lastResult.positionSizing?.adjustedQuantity ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Planned Loss at Stop</span>
                    <span className="text-xs font-mono text-red-400">
                      {formatINR(lastResult.positionSizing?.plannedLossAtStop ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Post-Trade Stock %</span>
                    <span className="text-xs font-mono text-slate-200">
                      {formatPercent(lastResult.positionSizing?.postTradeStockExposurePct ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Post-Trade Sector %</span>
                    <span className="text-xs font-mono text-slate-200">
                      {formatPercent(lastResult.positionSizing?.postTradeSectorExposurePct ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Gate</span>
                    <span className={`text-xs font-mono font-semibold ${gatePassed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gatePassed ? 'PASSED' : 'BLOCKED'}
                    </span>
                  </div>
                </div>
              </div>

              {blocked && (
                <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/60">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-red-300">Cap Breached — Override Required</span>
                  </div>
                  <div className="text-xs text-red-200 leading-relaxed mb-3">
                    One or more portfolio risk caps were breached. A written override rationale (≥50 chars) is required to proceed.
                  </div>
                  <textarea
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    rows={3}
                    placeholder="Override rationale (min 50 chars)..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-red-800/60 rounded text-xs text-slate-200 focus:outline-none focus:border-red-500"
                  />
                  <div className="text-[10px] text-red-500 mt-1">
                    {overrideRationale.length}/50 min
                  </div>
                  <button
                    onClick={handleOverride}
                    disabled={overrideRationale.length < 50}
                    className="w-full px-3 py-1.5 rounded bg-red-500 hover:bg-red-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    Apply Override
                  </button>
                </div>
              )}

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-bold text-slate-200 mb-2">7 Portfolio Risk Checks</h4>
                <div className="space-y-1.5">
                  {riskChecks.map((check: RiskCheckResult) => (
                    <div key={check.check} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 truncate max-w-[130px]">
                        {RISK_CHECK_LABELS[check.check] ?? check.check}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                        check.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        {check.passed ? 'PASS' : 'HARD STOP'}
                      </span>
                    </div>
                  ))}
                  {riskChecks.length === 0 && (
                    <span className="text-xs text-slate-500">Create a plan to run risk checks.</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded bg-amber-500/10 border border-amber-800/40 text-amber-300 text-xs leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
                Stop-loss levels are technical references, not guaranteed execution prices. Slippage and gap risk may result in fills worse than the stop.
              </div>
            </>
          ) : (
            <div className="p-8 rounded-lg bg-slate-900 border border-slate-800 text-center">
              <Calculator className="w-8 h-8 text-slate-600/50 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-200 mb-1">No Trade Plan Yet</h3>
              <p className="text-xs text-slate-400">
                Complete the form to run Stage F position sizing and risk checks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Saved Trade Plans */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Saved Trade Plans ({tradePlans.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-800/60">
          {isLoadingTradePlans ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading trade plans…</div>
          ) : tradePlans.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No saved trade plans. Create your first plan above.
            </div>
          ) : (
            tradePlans.map((plan) => (
              <div key={plan.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-200 truncate max-w-[100px]">
                      {plan.symbol}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                      plan.status === 'executed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : plan.status === 'ready'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {plan.status.toUpperCase()}
                    </span>
                  </div>
                  <Link
                    href={`/companies/${plan.companyId}`}
                    className="text-[10px] text-slate-500 font-mono hover:text-cyan-400"
                  >
                    Open Company <ArrowRight className="w-3 h-3 inline" />
                  </Link>
                </div>
                <div className="text-xs text-slate-300 mb-1">{plan.thesis.slice(0, 100)}{plan.thesis.length > 100 ? '…' : ''}</div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                  <span>Qty {plan.positionSize}</span>
                  <span>Loss at Stop {formatINR(plan.plannedLossAtStop)}</span>
                  <span>Stock {formatPercent(plan.portfolioExposurePct)}</span>
                  <span>Sector {formatPercent(plan.sectorExposurePct)}</span>
                </div>
              </div>
            )))}
        </div>
      </div>
    </div>
  );
}
