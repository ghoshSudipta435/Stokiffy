import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface RedFlagIndicatorProps {
  severity: 'HARD' | 'WARNING';
  code: string;
  title: string;
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  compact?: boolean;
}

export function RedFlagIndicator({
  severity,
  code,
  title,
  status = 'ACTIVE',
  compact = false,
}: RedFlagIndicatorProps) {
  const isHard = severity === 'HARD';

  if (compact) {
    return (
      <span
        title={`Audit Flag [${severity}]: ${title}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
          isHard
            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
        }`}
      >
        {isHard ? <AlertCircle className="w-3 h-3 text-red-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
        <span>{code}</span>
      </span>
    );
  }

  return (
    <div
      className={`p-3 rounded-lg border ${
        isHard
          ? 'bg-slate-900 border-red-900/60 text-slate-200'
          : 'bg-slate-900 border-amber-900/60 text-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded ${
              isHard
                ? 'bg-red-950/60 border border-red-800/60 text-red-400'
                : 'bg-amber-950/60 border border-amber-800/60 text-amber-400'
            }`}
          >
            {isHard ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-100">
                {code}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase ${
                  isHard
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                CLASSIFICATION: {severity}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-100 mt-0.5">{title}</h4>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
            status === 'ACTIVE'
              ? 'bg-slate-800 text-slate-300 border border-slate-700'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
