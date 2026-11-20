import React from 'react';

interface FinancialMetricProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: {
    value: number;
    formatted: string;
    isPositiveGood?: boolean;
  };
  benchmark?: string;
  tooltip?: string;
}

export function FinancialMetric({
  label,
  value,
  subValue,
  change,
  benchmark,
  tooltip,
}: FinancialMetricProps) {
  const getChangeColor = () => {
    if (!change) return '';
    const isPositiveGood = change.isPositiveGood !== false;
    if (change.value > 0) {
      return isPositiveGood ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10';
    }
    if (change.value < 0) {
      return isPositiveGood ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10';
    }
    return 'text-slate-400 bg-slate-800';
  };

  return (
    <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400" title={tooltip}>
          {label}
        </span>
        {change && (
          <span
            className={`px-1.5 py-0.5 text-[11px] font-mono font-medium rounded ${getChangeColor()}`}
          >
            {change.formatted}
          </span>
        )}
      </div>

      <div className="mt-1">
        <div className="text-xl font-bold font-mono tracking-tight text-slate-100">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-slate-400 font-mono mt-0.5">{subValue}</div>
        )}
      </div>

      {benchmark && (
        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Benchmark</span>
          <span className="font-mono text-slate-400">{benchmark}</span>
        </div>
      )}
    </div>
  );
}
