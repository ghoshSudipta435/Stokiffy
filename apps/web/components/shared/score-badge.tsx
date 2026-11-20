import React from 'react';

export type StageVerdict =
  | 'PASSED'
  | 'FAILED'
  | 'PENDING'
  | 'UNDERVALUED'
  | 'FAIR'
  | 'OVERVALUED'
  | 'TRIGGERED'
  | 'WAITING'
  | 'REJECTED'
  | 'APPROVED'
  | 'BLOCKED';

interface ScoreBadgeProps {
  verdict?: StageVerdict;
  score?: number;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({
  verdict,
  score,
  maxScore = 100,
  label,
  size = 'md',
}: ScoreBadgeProps) {
  const getVerdictStyles = (v?: StageVerdict) => {
    switch (v) {
      case 'PASSED':
      case 'UNDERVALUED':
      case 'TRIGGERED':
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'FAILED':
      case 'OVERVALUED':
      case 'REJECTED':
      case 'BLOCKED':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'FAIR':
      case 'WAITING':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'PENDING':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded border font-mono font-medium ${sizeClasses[size]} ${getVerdictStyles(
        verdict
      )}`}
    >
      {label && <span className="opacity-70">{label}:</span>}
      {score !== undefined ? (
        <span>
          {score}
          <span className="opacity-60 text-[10px]">/{maxScore}</span>
        </span>
      ) : (
        <span>{verdict || 'N/A'}</span>
      )}
    </div>
  );
}
