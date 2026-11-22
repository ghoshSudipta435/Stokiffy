'use client';

import React, { useMemo } from 'react';
import type { FinancialStatement } from '@stock-assistant/contracts';

interface AnnualPoint {
  fiscalYear: string;
  sales: number | null;
  netProfit: number | null;
  opmPct: number | null;
  rocePct: number | null;
}

interface FundamentalTrendChartProps {
  financials: FinancialStatement[];
  height?: number;
}

const CURRENCY_COLOR = '#22d3ee'; // cyan-400
const PROFIT_COLOR = '#34d399'; // emerald-400
const OPM_COLOR = '#fbbf24'; // amber-400
const ROCE_COLOR = '#60a5fa'; // blue-400

function toAnnualPoints(
  financials: FinancialStatement[]
): AnnualPoint[] {
  const byYear = new Map<string, FinancialStatement>();
  for (const s of financials) {
    if (s.periodType !== 'Annual') continue;
    const fy = s.fiscalYear;
    const existing = byYear.get(fy);
    // keep the latest reported version per year
    if (!existing || s.createdAt > existing.createdAt) {
      byYear.set(fy, s);
    }
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, s]) => {
      const get = (key: keyof FinancialStatement): number | null => {
        const v = (s as unknown as Record<string, { value: number | null }>)[key];
        return v ? v.value : null;
      };
      const revenue = get('revenue');
      const netProfit = get('netProfit');
      const operatingProfit = get('operatingProfit');
      const totalAssets = get('totalAssets');
      const currentLiabilities = get('currentLiabilities');
      const ebit = get('ebit');

      const opmPct =
        revenue !== null && operatingProfit !== null && revenue !== 0
          ? (operatingProfit / revenue) * 100
          : null;
      const employedCapital =
        totalAssets !== null && currentLiabilities !== null
          ? totalAssets - currentLiabilities
          : null;
      const rocePct =
        ebit !== null && employedCapital !== null && employedCapital !== 0
          ? (ebit / employedCapital) * 100
          : null;

      return {
        fiscalYear: s.fiscalYear,
        sales: revenue,
        netProfit,
        opmPct,
        rocePct,
      };
    });
}

function inr(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short',
  }).format(n);
}

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${n.toFixed(1)}%`;
}

export function FundamentalTrendChart({
  financials,
  height = 340,
}: FundamentalTrendChartProps) {
  const points = useMemo(() => toAnnualPoints(financials), [financials]);

  if (points.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center rounded-lg bg-slate-950 border border-slate-800">
        <p className="text-xs text-slate-500 font-mono">
          No 5-year financial data available. Run Stage B analysis to populate trends.
        </p>
      </div>
    );
  }

  const years = points.map((p) => p.fiscalYear);
  const n = points.length;

  // ---- scales ----
  const salesValues = points.map((p) => p.sales ?? 0);
  const profitValues = points.map((p) => p.netProfit ?? 0);
  const barMax = Math.max(0, ...salesValues, ...profitValues);
  const barScaleMax = barMax === 0 ? 1 : barMax * 1.12;

  const lineValues = [
    ...points.map((p) => p.opmPct ?? 0),
    ...points.map((p) => p.rocePct ?? 0),
  ];
  const lineMax = Math.max(0, ...lineValues);
  const lineScaleMax = lineMax === 0 ? 30 : lineMax * 1.35;

  // ---- dimensions ----
  const baseW = 700;
  const baseH = height;
  const pad = { left: 56, right: 26, top: 24, bottom: 34 };
  const chartW = baseW - pad.left - pad.right;
  const panelGap = 16;
  const topPanelH = (baseH - pad.top - pad.bottom - panelGap) * 0.42;
  const bottomPanelH = (baseH - pad.top - pad.bottom - panelGap) * 0.58;
  const topY0 = pad.top;
  const bottomY0 = pad.top + topPanelH + panelGap;
  const x0 = pad.left;
  const x1 = pad.left + chartW;

  const xScale = (i: number) =>
    n === 1 ? x0 + chartW / 2 : x0 + (i / (n - 1)) * chartW;

  // Y scales
  const barY = (v: number) => bottomY0 + bottomPanelH - (v / barScaleMax) * bottomPanelH;
  const lineY = (v: number) => topY0 + topPanelH - (v / lineScaleMax) * topPanelH;

  // ---- content ----
  const maxSales = Math.max(...salesValues);
  const maxProfit = Math.max(...profitValues);
  const maxOpm = Math.max(0, ...points.map((p) => p.opmPct ?? 0));
  const maxRoce = Math.max(0, ...points.map((p) => p.rocePct ?? 0));

  return (
    <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          5-Year Fundamental Trend
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Sales &amp; Net Profit (bars) • OPM % &amp; ROCE % (lines)
        </p>
      </div>
      <div className="px-3 pb-2">
        <svg
          width="100%"
          height={baseH}
          viewBox={`0 0 ${baseW} ${baseH}`}
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          {/* Bottom panel: Sales & Net Profit grouped bars */}
          <g transform={`translate(0, ${bottomY0})`}>
          {/* Y axis labels (currency) */}
          {[0, barScaleMax / 2, barScaleMax].map((v, i) => {
            const y = barY(v);
            const label = inr(v);
            return (
              <g key={i}>
                  <text
                    x={pad.left - 6}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                  <line
                    x1={pad.left}
                    x2={x1}
                    y1={y}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                </g>
              );
            })}
            {/* Bars */}
            {points.map((p, i) => {
              const x = xScale(i);
              const band = 22;
              const gap = 6;
              const salesH = p.sales !== null ? bottomPanelH - barY(p.sales) : 0;
              const profitH = p.netProfit !== null ? bottomPanelH - barY(p.netProfit) : 0;
              const base = bottomY0 + bottomPanelH;
              return (
                <g key={`bar-${i}`} transform={`translate(${x - band / 2}, 0)`}>
                  <rect
                    x={0}
                    y={base - salesH}
                    width={gap}
                    height={Math.max(salesH, 1)}
                    fill={CURRENCY_COLOR}
                    opacity={0.85}
                    rx={2}
                  />
                  <rect
                    x={gap}
                    y={base - profitH}
                    width={gap}
                    height={Math.max(profitH, 1)}
                    fill={PROFIT_COLOR}
                    opacity={0.85}
                    rx={2}
                  />
                  {/* value labels */}
                  {p.sales !== null && salesH > 8 && (
                    <text
                      x={gap / 2}
                      y={base - salesH - 6}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {inr(p.sales)}
                    </text>
                  )}
                  {p.netProfit !== null && profitH > 8 && (
                    <text
                      x={gap + gap / 2}
                      y={base - profitH - 6}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {inr(p.netProfit)}
                    </text>
                  )}
                </g>
              );
            })}
            {/* X axis labels */}
            {points.map((p, i) => (
              <text
                key={`x-${i}`}
                x={xScale(i)}
                y={bottomY0 + bottomPanelH + 20}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
              >
                {p.fiscalYear.replace('FY', "'")}
              </text>
            ))}
            {/* X axis title */}
            <text
              x={pad.left + chartW / 2}
              y={bottomY0 + bottomPanelH + 36}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              Fiscal Year
            </text>
          </g>

          {/* Top panel: OPM % & ROCE % lines */}
          <g transform={`translate(0, ${topY0})`}>
            {/* Y axis labels (percent, right side) */}
            {[0, lineScaleMax / 2, lineScaleMax].map((v, i) => {
              const y = lineY(v);
              const label = `${v.toFixed(0)}%`;
              return (
                <g key={i}>
                  <text
                    x={x1 + 6}
                    y={y + 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                  <line
                    x1={pad.left}
                    x2={x1}
                    y1={y}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                </g>
              );
            })}
            {/* Lines */}
            {[
              { key: 'opm', color: OPM_COLOR, get: (p: AnnualPoint) => p.opmPct },
              { key: 'roce', color: ROCE_COLOR, get: (p: AnnualPoint) => p.rocePct },
            ].map((series) => {
              const pts = points
                .map((p, i) => {
                  const v = series.get(p);
                  return v === null ? null : { x: xScale(i), y: lineY(v), v };
                })
                .filter((p): p is { x: number; y: number; v: number } => p !== null);
              if (pts.length === 0) return null;
              const linePoints = pts.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <g key={series.key}>
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {pts.map((p) => (
                    <circle
                      key={p.x}
                      cx={p.x}
                      cy={p.y}
                      r={3}
                      fill={series.color}
                      stroke="#0f172a"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              );
            })}
            {/* Line value labels (latest value at right edge) */}
            {[
              { key: 'opm', label: 'OPM %', color: OPM_COLOR, get: (p: AnnualPoint) => p.opmPct },
              { key: 'roce', label: 'ROCE %', color: ROCE_COLOR, get: (p: AnnualPoint) => p.rocePct },
            ].map((series, i) => {
              const last = [...points].reverse().find((p) => series.get(p) !== null);
              if (!last) return null;
              const y = lineY(series.get(last)!);
              return (
                <text
                  key={series.key}
                  x={x1 + 6}
                  y={y + 4}
                  fill={series.color}
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {series.label}: {pct(series.get(last))}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-2 text-[9px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-cyan-400/90" />
            <span>Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400/90" />
            <span>Net Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-amber-400" />
            <span>OPM %</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-blue-400" />
            <span>ROCE %</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500">
              Max: {inr(maxSales)} / {inr(maxProfit)} •{' '}
              {maxOpm.toFixed(1)}% / {maxRoce.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
