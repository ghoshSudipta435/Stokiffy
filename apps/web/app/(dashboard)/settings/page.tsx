'use client';

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Clock,
  HelpCircle,
  AlertCircle,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import { useRuleSets } from '@/hooks/use-rule-sets';
import { IndustryBenchmark } from '@stock-assistant/contracts';

const DEFAULT_RISK = {
  riskBudgetPerTradePct: 1.0,
  maxStockExposurePct: 10.0,
  maxSectorExposurePct: 25.0,
  minRiskReward: 2.0,
  maxPositionPctOfADV: 10.0,
  lotSize: 1,
  cashBufferPct: 5.0,
  estimatedFeesPct: 0.1,
  slippagePct: 0.2,
};

type RiskLimits = typeof DEFAULT_RISK;

type Benchmark = IndustryBenchmark;

export default function SettingsPage() {
  const {
    ruleSets,
    isLoadingRuleSets,
    updateRuleSetSettings,
    isUpdatingRuleSetSettings,
  } = useRuleSets();

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const ruleSet = ruleSets[0];

  const [risk, setRisk] = useState<RiskLimits>(ruleSet?.riskLimits ?? DEFAULT_RISK);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>(
    (ruleSet?.benchmarks ?? []).map((b) => ({
      industry: b.industry,
      benchmarkPe: b.benchmarkPe,
      minRoce: b.minRoce,
      maxDebtToEquity: b.maxDebtToEquity,
    }))
  );

  if (isLoadingRuleSets) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <Save className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading rule sets…</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      await updateRuleSetSettings({
        riskLimits: {
          riskBudgetPerTradePct: risk.riskBudgetPerTradePct,
          maxStockExposurePct: risk.maxStockExposurePct,
          maxSectorExposurePct: risk.maxSectorExposurePct,
          minRiskReward: risk.minRiskReward,
          maxPositionPctOfADV: risk.maxPositionPctOfADV,
          lotSize: risk.lotSize,
          cashBufferPct: risk.cashBufferPct,
          estimatedFeesPct: risk.estimatedFeesPct,
          slippagePct: risk.slippagePct,
        },
        benchmarks: benchmarks.map((b) => ({
          industry: b.industry,
          opmMinPct: b.opmMinPct,
          opmMaxPct: b.opmMaxPct,
          typicalPE: b.typicalPE,
          minRoaPct: b.minRoaPct,
          sourceNote: b.sourceNote,
          minOperatingMargin: b.minOperatingMargin,
          maxOperatingMargin: b.maxOperatingMargin,
          benchmarkPe: b.benchmarkPe,
          minRoa: b.minRoa,
          minRoce: b.minRoce,
          maxDebtToEquity: b.maxDebtToEquity,
          minCurrentRatio: b.minCurrentRatio,
        })),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const addBenchmark = () => {
    setBenchmarks([...benchmarks, { industry: '', benchmarkPe: undefined, minRoce: undefined, maxDebtToEquity: undefined }]);
  };

  const removeBenchmark = (idx: number) => {
    setBenchmarks(benchmarks.filter((_, i) => i !== idx));
  };

  return (
    <form
      id="settings-form"
      onSubmit={handleSave}
      className="space-y-6"
    >
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Workstation Settings & Financial Policy Governance
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Portfolio risk defaults • Industry benchmarks • Rule set configuration.
        </p>
      </div>

      {saveStatus === 'saved' && (
        <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <Save className="w-3.5 h-3.5" />
          <span>Settings saved successfully.</span>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="p-3 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          Save failed. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Profile */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Workstation Runtime Profile</span>
          </h2>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Mode</span>
              <span className="text-emerald-400 font-bold">Personal Workstation (Single Owner)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Market Coverage</span>
              <span className="text-slate-200 font-bold">NSE / BSE Equities</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Core Calculation Engine</span>
              <span className="text-slate-200 font-bold">
                packages/core (Pure TypeScript / Decimal.js)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Worker Queue Engine</span>
              <span className="text-slate-200 font-bold">pg-boss (PostgreSQL queues)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Active Rule Set</span>
              <span className="text-cyan-400 font-bold font-mono">
                {ruleSet?.version ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Governance Notice */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>20 User Policy Decisions Status</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            In accordance with Stokiffy Phase 1A governance, all 20 investment policy decisions remain strictly{' '}
            <strong className="text-amber-300">PENDING USER DECISION</strong>.
            Financial thresholds are configurable parameters below and are not hardcoded into application business logic.
          </p>
          <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded text-xs text-amber-200 font-mono">
            Status: 20 Tracked • 0 Approved • Decisions Isolated in Strategy Registry
          </div>
        </div>
      </div>

      {/* Portfolio Risk Defaults */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Portfolio Risk Defaults (Stage F)
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Risk per trade, position/sector caps, R:R, cash buffer.
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
            saveStatus === 'saving' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {saveStatus === 'saving' ? 'Saving...' : 'Live'}
          </span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RiskInput
            label="Risk per Trade (%)"
            value={risk.riskBudgetPerTradePct}
            onChange={(v) => setRisk({ ...risk, riskBudgetPerTradePct: v })}
            suffix="%"
          />
          <RiskInput
            label="Max Stock Exposure (%)"
            value={risk.maxStockExposurePct}
            onChange={(v) => setRisk({ ...risk, maxStockExposurePct: v })}
            suffix="%"
          />
          <RiskInput
            label="Max Sector Exposure (%)"
            value={risk.maxSectorExposurePct}
            onChange={(v) => setRisk({ ...risk, maxSectorExposurePct: v })}
            suffix="%"
          />
          <RiskInput
            label="Min Risk:Reward"
            value={risk.minRiskReward}
            onChange={(v) => setRisk({ ...risk, minRiskReward: v })}
          />
          <RiskInput
            label="Cash Buffer (%)"
            value={risk.cashBufferPct}
            onChange={(v) => setRisk({ ...risk, cashBufferPct: v })}
            suffix="%"
          />
          <RiskInput
            label="Lot Size"
            value={risk.lotSize}
            onChange={(v) => setRisk({ ...risk, lotSize: v })}
          />
        </div>
      </div>

      {/* Industry Benchmarks */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Industry Benchmarks
            </h2>
            <p className="text-[10px] text-slate-500 ml-1">P/E, ROCE, D/E thresholds per industry</p>
          </div>
          <button
            type="button"
            onClick={addBenchmark}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors border border-slate-700"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Benchmark
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
              <tr>
                <th className="py-2 px-3">Industry</th>
                <th className="py-2 px-3 text-right">P/E</th>
                <th className="py-2 px-3 text-right">Min ROCE (%)</th>
                <th className="py-2 px-3 text-right">Max D/E</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {benchmarks.map((b, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3">
                    <input
                      value={b.industry}
                      onChange={(e) => {
                        const next = [...benchmarks];
                        next[i] = { ...next[i], industry: e.target.value };
                        setBenchmarks(next);
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      value={b.benchmarkPe ?? ''}
                      onChange={(e) => {
                        const next = [...benchmarks];
                        next[i] = { ...next[i], benchmarkPe: e.target.value ? parseFloat(e.target.value) : undefined } as IndustryBenchmark;
                        setBenchmarks(next);
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      value={b.minRoce ?? ''}
                      onChange={(e) => {
                        const next = [...benchmarks];
                        next[i] = { ...next[i], minRoce: e.target.value ? parseFloat(e.target.value) : undefined } as IndustryBenchmark;
                        setBenchmarks(next);
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      value={b.maxDebtToEquity ?? ''}
                      onChange={(e) => {
                        const next = [...benchmarks];
                        next[i] = { ...next[i], maxDebtToEquity: e.target.value ? parseFloat(e.target.value) : undefined } as IndustryBenchmark;
                        setBenchmarks(next);
                      }}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeBenchmark(i)}
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-end">
        <button
          type="submit"
          disabled={isUpdatingRuleSetSettings || saveStatus === 'saving'}
          className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
        >
          {isUpdatingRuleSetSettings || saveStatus === 'saving' ? (
            <Save className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          <span>Save Settings</span>
        </button>
      </div>
    </form>
  );
}

interface RiskInputProps {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  suffix?: string;
}

function RiskInput({ label, value, onChange, suffix }: RiskInputProps) {
  return (
    <div className="p-3 rounded bg-slate-950 border border-slate-800">
      <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">{label}</div>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : 0)}
        step="0.1"
        className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
      />
      <div className="text-[9px] text-slate-500 mt-0.5">{suffix ?? ''}</div>
    </div>
  );
}
