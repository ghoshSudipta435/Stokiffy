'use client';

import React, { useState, useCallback } from 'react';
import { FileText, Plus, Edit2 } from 'lucide-react';
import { useCompanyFinancials } from '@/hooks/use-manual-data';
import { AddFinancialsModal } from '@/components/company/add-financials-modal';
import type { EditableFinancialStatement } from '@/components/company/add-financials-modal';
import { formatINR, formatRatio } from '@/lib/formatters';

interface FinancialsTablePanelProps {
  companyId: string;
}

type StatementRow = EditableFinancialStatement & {
  id: string;
  period: string;
  source: string;
  operatingCashFlow: number | null;
  debtorDays: number | null;
};

function mapToRow(s: any): StatementRow {
  // The API returns flattened number values at runtime, even though the contract
  // type wraps them in { value, provenance }. Access defensively.
  const getNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && 'value' in v) return (v as { value: number | null }).value ?? null;
    return null;
  };

  const periodType = s.periodType === 'Annual' ? 'Annual' : 'Quarterly';
  const period =
    periodType === 'Quarterly' && s.fiscalQuarter
      ? `${s.fiscalYear}-Q${s.fiscalQuarter}`
      : s.fiscalYear;

  return {
    id: s.id,
    period,
    periodType,
    fiscalYear: s.fiscalYear,
    fiscalQuarter: s.fiscalQuarter,
    revenue: getNum(s.revenue),
    operatingProfit: getNum(s.operatingProfit),
    netProfit: getNum(s.netProfit),
    eps: getNum(s.eps),
    ebit: getNum(s.ebit),
    interestExpense: getNum(s.interestExpense),
    totalAssets: getNum(s.totalAssets),
    totalLiabilities: getNum(s.totalLiabilities),
    totalEquity: getNum(s.totalEquity),
    totalDebt: getNum(s.totalDebt),
    currentAssets: getNum(s.currentAssets),
    currentLiabilities: getNum(s.currentLiabilities),
    operatingCashFlow: getNum(s.fcf),
    fcf: getNum(s.fcf),
    debtorDays: null,
    source: s.sourceDocumentRef ?? 'MANUAL_ENTRY',
    sourceDocumentRef: s.sourceDocumentRef ?? 'MANUAL_ENTRY',
  };
}

export function FinancialsTablePanel({ companyId }: FinancialsTablePanelProps) {
  const { data: financials = [], isLoading } = useCompanyFinancials(companyId);
  const [periodFilter, setPeriodFilter] = useState<'Annual' | 'Quarterly' | 'All'>('All');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStatement, setEditStatement] = useState<StatementRow | null>(null);

  const rows = financials.map(mapToRow).filter((r) => {
    if (periodFilter === 'All') return true;
    return r.periodType === periodFilter;
  });

  const handleEdit = useCallback((row: StatementRow) => {
    setEditStatement(row);
    setAddModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    setAddModalOpen(false);
    setEditStatement(null);
  }, []);

  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Financial Statements
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriodFilter('All')}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
              periodFilter === 'All'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 border border-transparent'
            } border`}
          >
            All
          </button>
          <button
            onClick={() => setPeriodFilter('Annual')}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
              periodFilter === 'Annual'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 border border-transparent'
            } border`}
          >
            Annual
          </button>
          <button
            onClick={() => setPeriodFilter('Quarterly')}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
              periodFilter === 'Quarterly'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 border border-transparent'
            } border`}
          >
            Quarterly
          </button>
          <button
            onClick={() => {
              setEditStatement(null);
              setAddModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-[10px] transition-colors"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Statement
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[10px]">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
            <tr>
              <th className="py-2 px-3">Period</th>
              <th className="py-2 px-3 text-right">Revenue</th>
              <th className="py-2 px-3 text-right">Op. Profit</th>
              <th className="py-2 px-3 text-right">Net Profit</th>
              <th className="py-2 px-3 text-right">EPS</th>
              <th className="py-2 px-3 text-right">Equity</th>
              <th className="py-2 px-3 text-right">Total Debt</th>
              <th className="py-2 px-3 text-right">CFO</th>
              <th className="py-2 px-3 text-right">FCF</th>
              <th className="py-2 px-3 text-center">Source</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500">
                  Loading financials…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500">
                  No {periodFilter === 'All' ? 'financial' : periodFilter.toLowerCase()} statements found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/40 transition-colors border-b border-slate-800/50 last:border-b-0"
                >
                  <td className="py-2.5 px-3 font-mono text-slate-200 truncate">
                    {row.period}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.revenue)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.operatingProfit)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.netProfit)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatRatio(row.eps)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.totalEquity)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.totalDebt)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.operatingCashFlow)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    {formatINR(row.fcf)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                      row.source === 'MANUAL_ENTRY'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {row.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleEdit(row)}
                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
                      title="Edit statement"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addModalOpen && (
        <AddFinancialsModal
          isOpen={addModalOpen}
          companyId={companyId}
          onClose={() => {
            setAddModalOpen(false);
            setEditStatement(null);
          }}
          onSuccess={handleSave}
          initialStatement={
            editStatement
              ? {
                  periodType: editStatement.periodType === 'Annual' ? 'Annual' : 'Quarterly',
                  fiscalYear: editStatement.fiscalYear,
                  fiscalQuarter: editStatement.fiscalQuarter,
                  revenue: editStatement.revenue,
                  operatingProfit: editStatement.operatingProfit,
                  netProfit: editStatement.netProfit,
                  eps: editStatement.eps,
                  ebit: editStatement.ebit,
                  interestExpense: editStatement.interestExpense,
                  totalAssets: editStatement.totalAssets,
                  totalLiabilities: editStatement.totalLiabilities,
                  totalEquity: editStatement.totalEquity,
                  totalDebt: editStatement.totalDebt,
                  currentAssets: editStatement.currentAssets,
                  currentLiabilities: editStatement.currentLiabilities,
                  fcf: editStatement.fcf,
                  sourceDocumentRef: editStatement.source,
                }
              : null
          }
        />
      )}
    </div>
  );
}
