'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';

interface AlertBarProps {
  hasHardFlags?: boolean;
  hardFlagCount?: number;
  warningCount?: number;
}

export function AlertBar({
  hardFlagCount = 0,
  warningCount = 0,
}: AlertBarProps) {
  if (hardFlagCount === 0 && warningCount === 0) {
    return null;
  }

  const isHard = hardFlagCount > 0;

  return (
    <div
      className={`w-full px-6 py-2 flex items-center justify-between text-xs font-medium border-b ${
        isHard
          ? 'bg-slate-900 border-slate-800 text-red-300'
          : 'bg-slate-900 border-slate-800 text-amber-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className={`w-4 h-4 ${isHard ? 'text-red-400' : 'text-amber-400'}`} />
        <span>
          {isHard ? (
            <>
              <strong>AUDIT NOTICE:</strong> {hardFlagCount} flagged item recorded in audit register (classification: HARD). Policy rules remain pending user decision.
            </>
          ) : (
            <>
              <strong>AUDIT NOTICE:</strong> {warningCount} flagged item recorded in audit register (classification: WARNING).
            </>
          )}
        </span>
      </div>

      <Link
        href="/screener?tab=flags"
        className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity"
      >
        <span>Inspect Register</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
