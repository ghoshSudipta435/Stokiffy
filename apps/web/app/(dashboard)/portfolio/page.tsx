'use client';

import React from 'react';
import { PieChart, Info } from 'lucide-react';
import { FinancialMetric } from '@/components/shared/financial-metric';
import { formatINR, formatPercent } from '@/lib/formatters';
import { usePortfolioSummary } from '@/hooks/use-portfolio';
import { usePortfolioPositions } from '@/hooks/use-portfolio';

interface PositionBadge {
  label: 'HOLD' | 'REVIEW_REQUIRED' | 'TRIM_CANDIDATE' | 'EXIT_CANDIDATE';
  color: string;
}

function recommendationBadge(pnlPct: number): PositionBadge {
  if (pnlPct <= -15) return { label: 'EXIT_CANDIDATE', color: 'bg-red-500/10 text-red-400 border border-red-500/30' };
  if (pnlPct <= -5) return { label: 'TRIM_CANDIDATE', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' };
  if (pnlPct >= 25) return { label: 'REVIEW_REQUIRED', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' };
  return { label: 'HOLD', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' };
}

export default function PortfolioPage() {
  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: positions = [], isLoading: positionsLoading } = usePortfolioPositions();

  const isLoading = summaryLoading || positionsLoading;

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <PieChart className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading portfolio…</p>
      </div>
    );
  }

  const totalValue = summary?.totalValue ?? 0;
  const cash = summary?.cash ?? 0;
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const investedValue = totalValue - cash;

  // Sector concentration
  const sectorExposure = summary?.sectorExposure ?? {};
  const sectors = Object.entries(sectorExposure).map(([sector, pct]) => ({
    sector,
    pct,
  }));

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage F: Portfolio Risk & Position Layout
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Live portfolio summary, position-level risk, and sector concentration.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Live Portfolio Data:</strong>
          <p className="mt-1 text-slate-400">
            Summary and positions are fetched from the portfolio API. Position-level stop loss,
            target, and thesis status reflect the latest trade plan state.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialMetric
          label="Total Portfolio Value"
          value={totalValue > 0 ? `₹${totalValue.toLocaleString('en-IN')}` : '—'}
          subValue={`Cash: ₹${cash.toLocaleString('en-IN')} • ${positions.length} positions`}
        />
        <FinancialMetric
          label="Unrealised P&L"
          value={
            summary?.unrealisedPnl ?? 0 >= 0
              ? `+${formatINR(summary?.unrealisedPnl ?? 0)}`
              : `-${formatINR(Math.abs(summary?.unrealisedPnl ?? 0))}`
          }
          subValue={formatPercent(summary?.unrealisedPnlPct ?? 0)}
        />
        <FinancialMetric
          label="Cash Buffer"
          value={formatPercent(cashPct)}
          subValue="Cash vs total value"
        />
        <FinancialMetric
          label="Invested Value"
          value={investedValue > 0 ? `₹${investedValue.toLocaleString('en-IN')}` : '—'}
          subValue="Deployed across positions"
        />
      </div>

      {/* Sector Concentration Bars */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-200">Sector Concentration</h2>
        </div>
        <div className="p-4">
          {sectors.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-4">
              No sector exposure data.
            </div>
          ) : (
            <div className="space-y-3">
              {sectors.map(({ sector, pct }) => (
                <div key={sector} className="flex items-center gap-3">
                  <span className="w-24 text-[10px] text-slate-400 font-mono truncate">
                    {sector}
                  </span>
                  <div className="flex-1 bg-slate-800/50 rounded h-3 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/40 rounded h-3"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    ></div>
                  </div>
                  <span className="w-10 text-[10px] text-right text-slate-200 font-mono">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Open Positions</h2>
          <span className="text-xs text-slate-400 font-mono">
            {positions.length} Position{(positions.length !== 1 ? 's' : '')}
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-xs">
            No open positions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Sector</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Avg Price</th>
                  <th className="py-2.5 px-4 text-right">CMP</th>
                  <th className="py-2.5 px-4 text-right">Market Value</th>
                  <th className="py-2.5 px-4 text-right">Unrealised P&L</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {positions.map((pos) => {
                  const badge = recommendationBadge(pos.unrealisedPnlPct);
                  const pnlColor =
                    pos.unrealisedPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <tr
                      key={pos.symbol}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-cyan-400 truncate">
                        {pos.symbol}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300 truncate">
                        {pos.sector}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        {pos.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {formatINR(pos.avgPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-100 font-bold">
                        {formatINR(pos.currentPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        {formatINR(pos.marketValue)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${pnlColor}`}>
                        {pos.unrealisedPnl >= 0 ? '+' : ''}{formatINR(pos.unrealisedPnl)}
                        <span className="text-slate-500 ml-1">({formatPercent(pos.unrealisedPnlPct)})</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`${badge.color} px-2 py-0.5 rounded text-[9px] font-mono`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
