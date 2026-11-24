'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
} from 'lucide-react';
import { useCompany } from '@/hooks/use-company';
import { useFlags } from '@/hooks/use-flags';
import { useCompanyFinancials, usePriceBars } from '@/hooks/use-manual-data';
import { ScoreBadge } from '@/components/shared/score-badge';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';
import { StageAPanel } from '@/components/company/stage-a-panel';
import { StageBPanel } from '@/components/company/stage-b-panel';
import { StageCPanel } from '@/components/company/stage-c-panel';
import { StageDPanel } from '@/components/company/stage-d-panel';
import { StageEPanel } from '@/components/company/stage-e-panel';
import { FinancialsTablePanel } from '@/components/company/financials-table-panel';
import { AddFinancialsModal } from '@/components/company/add-financials-modal';
import { FlagOverrideModal } from '@/components/company/flag-override-modal';
import { exportMemo } from '@/components/company/export-memo';
import type { CompanyDetailDTO } from '@/app/api/v1/companies/[id]/route';
import type { RedFlagDTO } from '@/app/api/v1/flags/route';
import { apiClient } from '@/lib/api-client';
import type { StageARunResponse } from '@/app/api/v1/analyses/stage-a/route';
import type { StageBRunResponse } from '@/app/api/v1/analyses/stage-b/route';
import type { StageCRunResponse } from '@/app/api/v1/companies/[id]/moat-assessments/route';
import type { StageDRunResponse } from '@/app/api/v1/companies/[id]/valuations/route';
import type { StageERunResponse } from '@/app/api/v1/analyses/stage-e/route';

type Tab = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const TAB_LABELS: Record<Tab, string> = {
  A: 'Stage A — Quick Screening',
  B: 'Stage B — Deep Trend Analysis',
  C: 'Stage C — Business Model & Moat',
  D: 'Stage D — Valuation',
  E: 'Stage E — Technical Entry',
  F: 'Financials',
};

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = String(params.symbol || 'TCS').toUpperCase();

  const { data: company, isLoading, error } = useCompany(symbol);
  const { data: flagsData, acknowledgeFlag, isAcknowledging } = useFlags(
    company?.id
  );
  const { data: financials = [], isLoading: financialsLoading } = useCompanyFinancials(
    company?.id
  );
  const { data: priceBars = [], isLoading: priceBarsLoading } = usePriceBars(
    company?.id
  );
  const [activeTab, setActiveTab] = useState<Tab>('A');
  const [stageARun, setStageARun] = useState<StageARunResponse | null>(null);
  const [stageBRun, setStageBRun] = useState<StageBRunResponse | null>(null);
  const [stageCRun, setStageCRun] = useState<StageCRunResponse | null>(null);
  const [stageDRun, setStageDRun] = useState<StageDRunResponse | null>(null);
  const [stageERun, setStageERun] = useState<StageERunResponse | null>(null);
  const [openFlagId, setOpenFlagId] = useState<string | null>(null);
  const [addFinancialsOpen, setAddFinancialsOpen] = useState(false);

  const handleRunStageA = useCallback(async () => {
    if (!company) return;
    try {
      const response = await apiClient.post<StageARunResponse>(
        '/api/v1/analyses/stage-a',
        { companyId: company.id, symbol: company.symbol }
      );
      setStageARun(response.data);
    } catch {
      // Error handled by API route
    }
  }, [company]);

  const handleRunStageB = useCallback(async () => {
    if (!company) return;
    try {
      const response = await apiClient.post<StageBRunResponse>(
        '/api/v1/analyses/stage-b',
        { companyId: company.id, symbol: company.symbol }
      );
      setStageBRun(response.data);
    } catch {
      // Error handled by API route
    }
  }, [company]);

  const handleRunStageC = useCallback(async () => {
    if (!company) return;
    try {
      const response = await apiClient.post<StageCRunResponse>(
        `/api/v1/companies/${encodeURIComponent(company.id)}/moat-assessments`,
        {
          businessModel: [],
          moatTests: [
            { testId: 1, answer: 'uncertain', confidence: 'low', rationale: '', evidence: [] },
            { testId: 2, answer: 'uncertain', confidence: 'low', rationale: '', evidence: [] },
            { testId: 3, answer: 'uncertain', confidence: 'low', rationale: '', evidence: [] },
            { testId: 4, answer: 'uncertain', confidence: 'low', rationale: '', evidence: [] },
            { testId: 5, answer: 'uncertain', confidence: 'low', rationale: '', evidence: [] },
          ],
          includeROEHistory: true,
        }
      );
      setStageCRun(response.data);
    } catch {
      // Error handled by API route
    }
  }, [company]);

  const handleRunStageD = useCallback(async () => {
    if (!company) return;
    try {
      const response = await apiClient.post<StageDRunResponse>(
        `/api/v1/companies/${encodeURIComponent(company.id)}/valuations`,
        { symbol: company.symbol }
      );
      setStageDRun(response.data);
    } catch {
      // Error handled by API route
    }
  }, [company]);

  const handleRunStageE = useCallback(async () => {
    if (!company) return;
    try {
      const response = await apiClient.post<StageERunResponse>(
        '/api/v1/analyses/stage-e',
        { companyId: company.id, symbol: company.symbol }
      );
      setStageERun(response.data);
    } catch {
      // Error handled by API route
    }
  }, [company]);

  const handleAcknowledgeFlag = async (flagId: string, reason: string) => {
    await acknowledgeFlag({ flagId, reason });
    setOpenFlagId(null);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        Loading company research for {symbol}...
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg max-w-lg mx-auto">
        <h2 className="text-lg font-bold text-slate-100 mb-2">Company Not Found</h2>
        <p className="text-xs text-slate-400 mb-4">
          {`No tracked company found for ticker '${symbol}'.`}
        </p>
        <Link
          href="/screener"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors"
        >
          Return to Screener
        </Link>
      </div>
    );
  }

  const activeFlags = (flagsData || []).filter((f) => f.status === 'ACTIVE');
  const latestStageAStatus = company.stages.stageAStatus;
  const latestStageBStatus = company.stages.stageBStatus;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-cyan-400">
                {company.symbol}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                {company.exchange}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                ISIN: {company.isin}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">
              {company.name} •{' '}
              <span className="text-slate-400">{company.sector} / {company.industry}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunStageA}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <Play className="w-3 h-3.5 mr-1.5" />
            Run Stage A
          </button>
          <button
            onClick={handleRunStageB}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <Play className="w-3 h-3.5 mr-1.5" />
            Run Stage B
          </button>
          <button
            onClick={handleRunStageC}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <Play className="w-3 h-3.5 mr-1.5" />
            Run Stage C
          </button>
          <button
            onClick={handleRunStageD}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <Play className="w-3 h-3.5 mr-1.5" />
            Run Stage D
          </button>
          <button
            onClick={handleRunStageE}
            className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            <Play className="w-3 h-3.5 mr-1.5" />
            Run Stage E
          </button>
          <button
            onClick={() => setAddFinancialsOpen(true)}
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-colors border border-slate-600"
          >
            <FileText className="w-3 h-3.5 mr-1.5" />
            Add Financials
          </button>
          <button
            onClick={() =>
              exportMemo({
                company,
                stageARun,
                stageBRun,
                stageCRun,
                stageDRun,
                stageERun,
                activeFlags,
              })
            }
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-colors border border-slate-600"
          >
            <Download className="w-3 h-3.5 mr-1.5" />
            Export Memo (.md)
          </button>
        </div>
      </div>

      {/* Data Coverage Pill */}
      <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[10px] text-slate-300 font-mono">
              {financials.length} Y Financials
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-[10px] text-slate-300 font-mono">
              {priceBars.length} Price Bars
            </span>
          </div>
        </div>
        {(financialsLoading || priceBarsLoading) && (
          <span className="text-[10px] text-slate-500 font-mono animate-pulse">
            Loading…
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-800">
        {(['A', 'B', 'C', 'D', 'E', 'F'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-4 py-3 text-xs font-mono font-medium transition-all ${
              activeTab === tab
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'A' && (
        <StageAPanel
          symbol={company.symbol}
          companyId={company.id}
          sector={company.sector}
          latestRun={stageARun}
          onRunComplete={() => {
            // Refresh flags after a new run
          }}
        />
      )}

      {activeTab === 'B' && (
        <StageBPanel
          symbol={company.symbol}
          companyId={company.id}
          sector={company.sector}
          latestRun={stageBRun}
          onRunComplete={() => {
            // Refresh flags after a new run
          }}
        />
      )}

      {activeTab === 'C' && (
        <StageCPanel
          symbol={company.symbol}
          companyId={company.id}
          sector={company.sector}
          latestRun={stageCRun}
          onRunComplete={() => {
            // Refresh flags after a new run
          }}
        />
      )}

      {activeTab === 'D' && (
        <StageDPanel
          symbol={company.symbol}
          companyId={company.id}
          sector={company.sector}
          latestRun={stageDRun}
          onRunComplete={() => {
            // Refresh flags after a new run
          }}
        />
      )}

      {activeTab === 'E' && (
        <StageEPanel
          symbol={company.symbol}
          companyId={company.id}
          sector={company.sector}
          latestRun={stageERun}
          onRunComplete={() => {
            // Refresh flags after a new run
          }}
        />
      )}

      {activeTab === 'F' && (
        <FinancialsTablePanel companyId={company.id} />
      )}

      {/* Red Flags & Override Workflow (shared across tabs) */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Red Flags & Override Workflow
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {activeFlags.length} active flag(s). Acknowledge with a rationale to create an auditable override.
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
            activeFlags.length > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {activeFlags.length} Active
          </span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {activeFlags.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-500 text-xs">
              No active red flags for this company.
            </div>
          ) : (
            activeFlags.map((flag) => (
              <div key={flag.id} className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <RedFlagIndicator
                    severity={flag.severity}
                    code={flag.code}
                    title={`${flag.symbol}: ${flag.title}`}
                    status={flag.status}
                  />
                  <button
                    onClick={() => setOpenFlagId(flag.id)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-slate-300 mb-1">{flag.evidence.description}</div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                    {flag.category}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                    Detected {flag.detectedAt.slice(0, 10)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {openFlagId && (
        <FlagOverrideModal
          flag={(flagsData || []).find((f) => f.id === openFlagId)!}
          isOpen
          onClose={() => setOpenFlagId(null)}
          onAcknowledged={() => {
            setOpenFlagId(null);
          }}
        />
      )}

      {addFinancialsOpen && (
        <AddFinancialsModal
          isOpen={addFinancialsOpen}
          companyId={company.id}
          onClose={() => setAddFinancialsOpen(false)}
          onSuccess={() => {
            setAddFinancialsOpen(false);
          }}
        />
      )}
    </div>
  );
}
