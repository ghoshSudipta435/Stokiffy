'use client';

import React, { useState } from 'react';
import { Crosshair, Info } from 'lucide-react';

export default function TradePlannerPage() {
  const [ticker, setTicker] = useState('TCS');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [capitalAllocation, setCapitalAllocation] = useState('');

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Stage E: Technical Entry & Trade Planning (UI Scaffolding)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Workstation layout for trade planning parameters. No financial calculations or entry rules are executed client-side.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Architectural Boundary & Policy Notice:</strong>
          <p className="mt-1 text-slate-400">
            In accordance with Phase 1A governance, position sizing calculations, pivot breakout rules (Decision 13),
            and stop-loss anchoring policies (Decision 14) are not calculated in frontend components.
            Execution logic is delegated to <code className="text-cyan-400">packages/core</code> and requires explicit user policy approval.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Parameters Form (Neutral Layout) */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span>Planned Trade Input Parameters</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Stock Ticker</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. TCS"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Planned Entry Price (INR)
              </label>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="Awaiting core engine parameter input"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Stop Loss Reference (INR)
              </label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Awaiting core engine parameter input"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Target Reference (INR)
              </label>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Awaiting core engine parameter input"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Allocated Capital (INR)
              </label>
              <input
                type="number"
                value={capitalAllocation}
                onChange={(e) => setCapitalAllocation(e.target.value)}
                placeholder="Awaiting core engine parameter input"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Engine Integration Placeholder */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-3">
              Execution Analysis (Pending Core Integration)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              When integrated with <code className="text-cyan-400">packages/core</code>, this view will display
              deterministic risk-reward calculations, position sizing output, and breakout confirmation audits
              according to finalized user investment policies.
            </p>

            <div className="p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-slate-400 space-y-2">
              <div className="flex justify-between">
                <span>Core Engine Status:</span>
                <span className="text-amber-400">PENDING_INTEGRATION</span>
              </div>
              <div className="flex justify-between">
                <span>Decision 13 (Pivot Breakout):</span>
                <span className="text-amber-400">PENDING USER DECISION</span>
              </div>
              <div className="flex justify-between">
                <span>Decision 14 (Stop-Loss Anchor):</span>
                <span className="text-amber-400">PENDING USER DECISION</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
            Phase 1A Scaffolding • Calculations Strictly Prohibited in UI Components
          </div>
        </div>
      </div>
    </div>
  );
}
