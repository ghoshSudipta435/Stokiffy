'use client';

import React, { useState, useCallback } from 'react';
import {
  Play,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  FileText,
  Check,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { StageCRunResponse } from '@/app/api/v1/companies/[id]/moat-assessments/route';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { formatDateTimeIST } from '@/lib/formatters';

interface StageCPanelProps {
  symbol: string;
  companyId: string;
  sector: string;
  latestRun?: StageCRunResponse | null;
  onRunComplete?: () => void;
}

const BUSINESS_MODEL_QUESTIONS: Array<{
  id: 'value-creation' | 'value-capture' | 'scalability';
  label: string;
  placeholder: string;
}> = [
  {
    id: 'value-creation',
    label: '1. Value Creation',
    placeholder: 'How does the company create value for customers?',
  },
  {
    id: 'value-capture',
    label: '2. Value Capture',
    placeholder: 'How does the company capture value (pricing, contracts, switching costs)?',
  },
  {
    id: 'scalability',
    label: '3. Scalability',
    placeholder: 'How does the business scale with incremental investment?',
  },
];

const MOAT_TYPES: Array<{
  id: 'BRAND' | 'NETWORK_EFFECT' | 'COST_ADVANTAGE' | 'SWITCHING_COST' | 'REGULATORY_PATENT';
  label: string;
  description: string;
}> = [
  {
    id: 'BRAND',
    label: 'Brand',
    description: 'Trusted brand enabling pricing power and premium vs peers',
  },
  {
    id: 'NETWORK_EFFECT',
    label: 'Network Effect',
    description: 'Value increases with participants, liquidity, and data advantages',
  },
  {
    id: 'COST_ADVANTAGE',
    label: 'Cost Advantage',
    description: 'Structural cost leadership through scale, process, or location',
  },
  {
    id: 'SWITCHING_COST',
    label: 'Switching Cost',
    description: 'High time, risk, or financial expense for customers to migrate',
  },
  {
    id: 'REGULATORY_PATENT',
    label: 'Regulatory / Patent',
    description: 'Durable legal barriers, patents, licenses, or government protection',
  },
];

const MOAT_TESTS: Array<{
  id: 1 | 2 | 3 | 4 | 5;
  label: string;
  question: string;
  inverted: boolean;
  mandatory: boolean;
  description: string;
}> = [
  {
    id: 1,
    label: 'Test 1 — Non-Copyability',
    question: 'Can competitors easily copy the business?',
    inverted: true,
    mandatory: true,
    description:
      'Inverted & mandatory: Answer "no" (cannot copy) with direct evidence. If the business is easily copyable, Stage C is hard-blocked.',
  },
  {
    id: 2,
    label: 'Test 2 — Durability (10+ Years)',
    question: 'Can the advantage last 10+ years?',
    inverted: false,
    mandatory: false,
    description: 'Answer "yes" with direct evidence that the moat is durable.',
  },
  {
    id: 3,
    label: 'Test 3 — ROE Consistency (10+ Years)',
    question: 'Has ROE been high & consistent for 10+ years?',
    inverted: false,
    mandatory: false,
    description: 'Answer "yes" with direct evidence. Optional 10Y ROE history cross-check.',
  },
  {
    id: 4,
    label: 'Test 4 — Pricing Power',
    question: 'Can the company raise prices without losing customers?',
    inverted: false,
    mandatory: false,
    description: 'Answer "yes" with direct evidence of pricing power.',
  },
  {
    id: 5,
    label: 'Test 5 — Market Share Stability',
    question: 'Is market share stable or growing?',
    inverted: false,
    mandatory: false,
    description: 'Answer "yes" with direct evidence of market share stability/growth.',
  },
];

const SOURCE_TYPES: Array<{
  id: 'filing' | 'transcript' | 'analyst-report' | 'news' | 'user-input' | 'derived';
  label: string;
}> = [
  { id: 'filing', label: 'Verified Fact — Filing' },
  { id: 'transcript', label: 'Verified Fact — Transcript' },
  { id: 'analyst-report', label: 'Analyst Estimate' },
  { id: 'news', label: 'News Report' },
  { id: 'user-input', label: 'User Input' },
  { id: 'derived', label: 'Derived' },
];

interface BMAnswer {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
  evidence: Array<{
    description: string;
    source: string;
    sourceType: string;
    relevance: 'direct' | 'supporting' | 'contextual';
  }>;
}

interface MoatTestInput {
  answer: 'yes' | 'no' | 'uncertain';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  evidence: Array<{
    description: string;
    source: string;
    sourceType: string;
    relevance: 'direct' | 'supporting' | 'contextual';
  }>;
}

export function StageCPanel({
  symbol,
  companyId,
  sector,
  latestRun,
  onRunComplete,
}: StageCPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StageCRunResponse | null>(latestRun ?? null);

  // Business model form state
  const [bmAnswers, setBmAnswers] = useState<Record<string, any>>(
    BUSINESS_MODEL_QUESTIONS.reduce((acc, q) => {
      acc[q.id] = { answer: '', confidence: 'medium', tags: ['verified-fact'], evidence: [] };
      return acc;
    }, {} as Record<string, any>)
  );
  const [businessModelCategory, setBusinessModelCategory] = useState<string>('');
  const [moatTypes, setMoatTypes] = useState<string[]>([]);

  // Moat tests form state
  const [moatTests, setMoatTests] = useState<Record<number, any>>(
    MOAT_TESTS.reduce((acc, t) => {
      acc[t.id] = {
        answer: 'uncertain',
        confidence: 'medium',
        rationale: '',
        evidence: [],
      };
      return acc;
    }, {} as Record<number, any>)
  );

  const [includeROEHistory, setIncludeROEHistory] = useState(true);

  const addEvidence = (type: 'bm' | 'test', key: any) => {
    if (type === 'bm') {
      setBmAnswers((prev: any) => ({
        ...prev,
        [key]: {
          ...prev[key],
          evidence: [
            ...prev[key].evidence,
            { description: '', source: '', sourceType: 'user-input', relevance: 'direct' },
          ],
        },
      }));
    } else {
      setMoatTests((prev: any) => ({
        ...prev,
        [key]: {
          ...prev[key],
          evidence: [
            ...prev[key].evidence,
            { description: '', source: '', sourceType: 'user-input', relevance: 'direct' },
          ],
        },
      }));
    }
  };

  const removeEvidence = (type: 'bm' | 'test', key: any, idx: any) => {
    if (type === 'bm') {
      setBmAnswers((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          evidence: prev[key].evidence.filter((_: any, i: any) => i !== idx),
        },
      }));
    } else {
      setMoatTests((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          evidence: prev[key].evidence.filter((_: any, i: any) => i !== idx),
        },
      }));
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await apiClient.post<StageCRunResponse>(
        `/api/v1/companies/${encodeURIComponent(companyId)}/moat-assessments`,
        {
          businessModel: BUSINESS_MODEL_QUESTIONS.map((q) => ({
            questionId: q.id,
            answer: bmAnswers[q.id].answer,
            confidence: bmAnswers[q.id].confidence,
            tags: bmAnswers[q.id].tags,
            evidence: bmAnswers[q.id].evidence,
          })),
          businessModelCategory: businessModelCategory || undefined,
          moatTypes: moatTypes.length > 0 ? moatTypes : undefined,
          moatTests: MOAT_TESTS.map((t: any) => ({
            testId: t.id,
            answer: moatTests[t.id].answer,
            confidence: moatTests[t.id].confidence,
            rationale: moatTests[t.id].rationale,
            evidence: moatTests[t.id].evidence,
          })),
          includeROEHistory,
        }
      );
      const data = response.data;
      setRunResult(data);
      onRunComplete?.();
    } catch {
      // Error handled by API route
    } finally {
      setIsRunning(false);
    }
  };

  const maxScore = runResult?.maxPossibleScore ?? 5;
  const moatPass = runResult?.moatPass ?? false;
  const gatePassed = runResult?.gatePassed ?? false;
  const canProceed = runResult?.canProceedToStageD ?? false;

  return (
    <div className="space-y-6">
      {/* Stage C Summary Header */}
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Stage C: Business Model & Moat
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gate{' '}
              {gatePassed ? (
                <span className="text-emerald-400">PASSED — Eligible for Stage D</span>
              ) : (
                <span className="text-red-400">BLOCKED — Moat protection required</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge
              verdict={moatPass ? 'PASSED' : 'BLOCKED'}
              score={runResult?.moatScore}
              maxScore={maxScore}
              size="lg"
            />
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${getVerdictColor(runResult?.verdictBand)}`}>
              {runResult?.verdictBand}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Moat Score</div>
            <div className="text-xl font-mono font-bold text-slate-100">
              {runResult?.moatScore ?? 0} / {maxScore}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Min pass: {runResult?.minPassScore ?? 3}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Confidence</div>
            <div className={`text-xs font-mono font-semibold ${getConfidenceColor(runResult?.overallConfidence)}`}>
              {runResult?.overallConfidence ?? '—'}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Moat Pass</div>
            <div className={`text-xs font-mono font-semibold ${moatPass ? 'text-emerald-400' : 'text-red-400'}`}>
              {moatPass ? 'PASSED' : 'FAILED'}
            </div>
          </div>
          <div className="p-4 rounded bg-slate-950 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono mb-1">Stage D</div>
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
              <Play className="w-3 h-3.5" />
            )}
            {isRunning ? 'Running...' : 'Run / Re-run Stage C'}
          </button>
          <span className="text-xs text-slate-500">
            {runResult ? `Last run: ${formatDateTimeIST(runResult.analysisRunId && 'now')}` : 'Not yet assessed'}
          </span>
        </div>
      </div>

      {/* Moat Assessment Form */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Moat Assessment Form
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Evidence-backed evaluation. Test 1 (Non-Copyability) is inverted and mandatory.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {/* Business Model Questions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase mb-1">Business Model (3 Questions)</h4>
            {BUSINESS_MODEL_QUESTIONS.map((q) => (
              <div key={q.id} className="p-3 rounded bg-slate-950/50 border border-slate-800">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-cyan-400">{q.label}</span>
                  <span className="text-[10px] text-slate-500">Evidence required</span>
                </div>
                <textarea
                  value={bmAnswers[q.id].answer}
                  onChange={(e) =>
                    setBmAnswers((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], answer: e.target.value },
                    }))
                  }
                  placeholder={q.placeholder}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500 min-h-[60px]"
                />
                <div className="flex items-center gap-3 mt-2">
                  <select
                    value={bmAnswers[q.id].confidence}
                    onChange={(e) =>
                      setBmAnswers((prev) => ({
                        ...prev,
                        [q.id]: { ...prev[q.id], confidence: e.target.value as 'high' | 'medium' | 'low' },
                      }))
                    }
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="high">High Confidence</option>
                    <option value="medium">Medium Confidence</option>
                    <option value="low">Low Confidence</option>
                  </select>
                  <div className="flex gap-1">
                    {SOURCE_TYPES.map((st) => (
                      <button
                        key={st.id}
                        onClick={() =>
                          setBmAnswers((prev) => {
                            const tags = prev[q.id].tags;
                            const has = tags.includes(st.id);
                            return {
                              ...prev,
                              [q.id]: {
                                ...prev[q.id],
                                tags: has ? tags.filter((t: any) => t !== st.id) : [...tags, st.id],
                              },
                            }
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[9px] border ${
                          bmAnswers[q.id].tags.includes(st.id)
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        {st.label.split(' — ')[1] || st.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-slate-500 mb-1">Evidence Items</div>
                  {bmAnswers[q.id].evidence.map((ev: any, idx: any) => (
                    <div key={idx} className="flex items-center gap-2 mt-1">
                      <input
                        value={ev.description}
                        onChange={(e) =>
                          setBmAnswers((prev) => {
                            const evs = [...prev[q.id].evidence];
                            evs[idx].description = e.target.value;
                            return { ...prev, [q.id]: { ...prev[q.id], evidence: evs } };
                          })
                        }
                        placeholder="Evidence description"
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <select
                        value={ev.sourceType}
                        onChange={(e) =>
                          setBmAnswers((prev) => {
                            const evs = [...prev[q.id].evidence];
                            evs[idx].sourceType = e.target.value as any;
                            return { ...prev, [q.id]: { ...prev[q.id], evidence: evs } };
                          })
                        }
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                      >
                        {SOURCE_TYPES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeEvidence('bm', q.id, idx)}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addEvidence('bm', q.id)}
                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] transition-colors border border-slate-700"
                  >
                    <Plus className="w-3 h-3" /> Add Evidence
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Business Model Category & Moat Types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded bg-slate-950/50 border border-slate-800">
              <div className="text-xs font-bold text-slate-300 uppercase mb-2">Business Model Category</div>
              <select
                value={businessModelCategory}
                onChange={(e) => setBusinessModelCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select category</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="MARKETPLACE">Marketplace</option>
                <option value="BRANDED_MANUFACTURING">Branded Manufacturing</option>
                <option value="COMMODITY_MANUFACTURING">Commodity Manufacturing</option>
                <option value="ASSET_LIGHT">Asset Light</option>
                <option value="ASSET_HEAVY">Asset Heavy</option>
                <option value="FREEMIUM">Freemium</option>
              </select>
            </div>
            <div className="p-3 rounded bg-slate-950/50 border border-slate-800">
              <div className="text-xs font-bold text-slate-300 uppercase mb-2">Moat Types</div>
              <div className="grid grid-cols-3 gap-1">
                {MOAT_TYPES.map((mt) => (
                  <button
                    key={mt.id}
                    onClick={() =>
                      setMoatTypes((prev) =>
                        prev.includes(mt.id)
                          ? prev.filter((t) => t !== mt.id)
                          : [...prev, mt.id]
                      )
                    }
                    className={`px-2 py-1.5 rounded text-[9px] border ${
                      moatTypes.includes(mt.id)
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                    title={mt.description}
                  >
                    {mt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Moat Tests */}
          <h4 className="text-xs font-bold text-slate-300 uppercase mb-2 mt-4">Moat Tests (5 Tests)</h4>
          <div className="space-y-2">
            {MOAT_TESTS.map((test) => (
              <div
                key={test.id}
                className={`p-3 rounded border ${
                  test.mandatory ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${
                      test.mandatory ? 'text-amber-400' : 'text-cyan-400'
                    }`}>
                      {test.label}
                    </span>
                    {test.mandatory && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-500/30 text-[9px]">
                        MANDATORY
                      </span>
                    )}
                    {test.inverted && (
                      <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30 text-[9px]">
                        INVERTED
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{test.description}</span>
                </div>
                <div className="text-xs text-slate-400 mb-2">{test.question}</div>
                <div className="flex gap-2">
                  {(['yes', 'no', 'uncertain'] as const).map((ans) => (
                    <button
                      key={ans}
                      onClick={() =>
                        setMoatTests((prev) => ({
                          ...prev,
                          [test.id]: { ...prev[test.id], answer: ans },
                        }))
                      }
                      className={`px-2.5 py-1 rounded text-xs font-mono ${
                        moatTests[test.id].answer === ans
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <label className="text-[10px] text-slate-500 block mb-1">Rationale</label>
                  <input
                    value={moatTests[test.id].rationale}
                    onChange={(e) =>
                      setMoatTests((prev) => ({
                        ...prev,
                        [test.id]: { ...prev[test.id], rationale: e.target.value },
                      }))
                    }
                    placeholder="Explain your reasoning..."
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-slate-500 mb-1">Evidence Items</div>
                  {moatTests[test.id].evidence.map((ev: any, idx: any) => (
                    <div key={idx} className="flex items-center gap-2 mt-1">
                      <input
                        value={ev.description}
                        onChange={(e) =>
                          setMoatTests((prev) => {
                            const evs = [...prev[test.id].evidence];
                            evs[idx].description = e.target.value;
                            return { ...prev, [test.id]: { ...prev[test.id], evidence: evs } };
                          })
                        }
                        placeholder="Evidence description"
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <select
                        value={ev.sourceType}
                        onChange={(e) =>
                          setMoatTests((prev) => {
                            const evs = [...prev[test.id].evidence];
                            evs[idx].sourceType = e.target.value as any;
                            return { ...prev, [test.id]: { ...prev[test.id], evidence: evs } };
                          })
                        }
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                      >
                        {SOURCE_TYPES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeEvidence('test', test.id, idx)}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addEvidence('test', test.id)}
                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] transition-colors border border-slate-700"
                  >
                    <Plus className="w-3 h-3" /> Add Evidence
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeROEHistory}
              onChange={(e) => setIncludeROEHistory(e.target.checked)}
              className="w-3 h-3 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <label className="text-xs text-slate-400">
              Include 10Y ROE history from financial statements
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      {runResult && (
        <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Results & Breakdown
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Evidence Gaps</span>
              <span className={`text-xs font-mono ${runResult.evidenceGaps.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {runResult.evidenceGaps.length} gap(s)
              </span>
            </div>
            {runResult.evidenceGaps.length > 0 ? (
              <ul className="text-xs text-slate-300 space-y-1 ml-4">
                {runResult.evidenceGaps.map((gap) => (
                  <li key={gap} className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-400">No evidence gaps.</p>
            )}

            {runResult.flags.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Generated Flags</div>
                <div className="space-y-1">
                  {runResult.flags.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <RedFlagIndicator
                        severity={f.severity}
                        code={f.code}
                        title={f.title}
                        status={f.status}
                        compact
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Test Breakdown</div>
              <div className="space-y-1">
                {runResult.ruleResults.map((r) => (
                  <div key={r.ruleKey} className="flex items-center justify-between px-2 py-1 text-xs">
                    <span className="font-mono text-slate-300">{r.testName}</span>
                    <span className={`text-[10px] font-mono ${
                      r.passed ? 'text-emerald-400' : r.unsubstantiated ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {r.passed ? 'PASS' : r.unsubstantiated ? 'UNVERIFIED' : 'FAIL'}
                    </span>
                    <span className="text-slate-500">({r.points} / {r.maxPoints} pts)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getVerdictColor(band: string | undefined) {
  switch (band) {
    case 'EXCEPTIONAL':
    case 'EXCELLENT':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'GOOD':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    case 'AVOID':
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

function getConfidenceColor(conf: string | undefined) {
  switch (conf) {
    case 'high':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'low':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    case 'unsubstantiated':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}
