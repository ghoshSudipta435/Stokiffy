'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, FileText, Save, AlertCircle } from 'lucide-react';
import { useUpsertFinancials } from '@/hooks/use-manual-data';

export interface EditableFinancialStatement {
  periodType: 'Annual' | 'Quarterly';
  fiscalYear: string;
  fiscalQuarter: string | null;
  revenue: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  eps: number | null;
  ebit: number | null;
  interestExpense: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  fcf: number | null;
  sourceDocumentRef: string | null;
}

interface AddFinancialsModalProps {
  isOpen: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialStatement?: EditableFinancialStatement | null;
}

type PeriodType = 'annual' | 'quarterly';

interface FinancialsFormData {
  periodType: PeriodType;
  fiscalYear: string;
  fiscalQuarter: string;
  revenue: string;
  operatingProfit: string;
  netProfit: string;
  eps: string;
  ebit: string;
  interestExpense: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalDebt: string;
  currentAssets: string;
  currentLiabilities: string;
  operatingCashFlow: string;
  freeCashFlow: string;
  debtorDays: string;
}

const EMPTY_FORM: FinancialsFormData = {
  periodType: 'annual',
  fiscalYear: '',
  fiscalQuarter: '',
  revenue: '',
  operatingProfit: '',
  netProfit: '',
  eps: '',
  ebit: '',
  interestExpense: '',
  totalAssets: '',
  totalLiabilities: '',
  totalEquity: '',
  totalDebt: '',
  currentAssets: '',
  currentLiabilities: '',
  operatingCashFlow: '',
  freeCashFlow: '',
  debtorDays: '',
};

const toNullableNumber = (val: string): number | null => {
  const trimmed = val.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export function AddFinancialsModal({
  isOpen,
  companyId,
  onClose,
  onSuccess,
  initialStatement,
}: AddFinancialsModalProps) {
  const [form, setForm] = useState<FinancialsFormData>(() => ({ ...EMPTY_FORM }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upsertFinancials = useUpsertFinancials(companyId);

  // Initialize form from an existing statement when editing
  useEffect(() => {
    if (initialStatement) {
      setForm({
        periodType: (initialStatement.periodType === 'Annual' ? 'annual' : 'quarterly') as PeriodType,
        fiscalYear: initialStatement.fiscalYear,
        fiscalQuarter: initialStatement.fiscalQuarter ?? '',
        revenue: initialStatement.revenue != null ? String(initialStatement.revenue) : '',
        operatingProfit: initialStatement.operatingProfit != null ? String(initialStatement.operatingProfit) : '',
        netProfit: initialStatement.netProfit != null ? String(initialStatement.netProfit) : '',
        eps: initialStatement.eps != null ? String(initialStatement.eps) : '',
        ebit: initialStatement.ebit != null ? String(initialStatement.ebit) : '',
        interestExpense: initialStatement.interestExpense != null ? String(initialStatement.interestExpense) : '',
        totalAssets: initialStatement.totalAssets != null ? String(initialStatement.totalAssets) : '',
        totalLiabilities: initialStatement.totalLiabilities != null ? String(initialStatement.totalLiabilities) : '',
        totalEquity: initialStatement.totalEquity != null ? String(initialStatement.totalEquity) : '',
        totalDebt: initialStatement.totalDebt != null ? String(initialStatement.totalDebt) : '',
        currentAssets: initialStatement.currentAssets != null ? String(initialStatement.currentAssets) : '',
        currentLiabilities: initialStatement.currentLiabilities != null ? String(initialStatement.currentLiabilities) : '',
        operatingCashFlow: initialStatement.fcf != null ? String(initialStatement.fcf) : '',
        freeCashFlow: initialStatement.fcf != null ? String(initialStatement.fcf) : '',
        debtorDays: '',
      });
    } else {
      setForm({ ...EMPTY_FORM, periodType: 'annual' });
    }
  }, [initialStatement]);

  const handleChange = (key: keyof FinancialsFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError(null);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const periodType = e.target.value as PeriodType;
    setForm((prev) => ({ ...prev, periodType }));
    if (periodType === 'annual') {
      setForm((prev) => ({ ...prev, fiscalQuarter: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.fiscalYear.trim()) {
      setError('Fiscal Year is required.');
      return;
    }

    if (form.periodType === 'quarterly' && !form.fiscalQuarter.trim()) {
      setError('Fiscal Quarter is required for quarterly statements.');
      return;
    }

    setIsSaving(true);
    try {
      const statement = {
        periodType: form.periodType,
        fiscalYear: form.fiscalYear.trim(),
        fiscalQuarter:
          form.periodType === 'quarterly' && form.fiscalQuarter.trim()
            ? form.fiscalQuarter.trim()
            : null,
        revenue: toNullableNumber(form.revenue),
        operatingProfit: toNullableNumber(form.operatingProfit),
        netProfit: toNullableNumber(form.netProfit),
        eps: toNullableNumber(form.eps),
        ebit: toNullableNumber(form.ebit),
        interestExpense: toNullableNumber(form.interestExpense),
        totalAssets: toNullableNumber(form.totalAssets),
        totalLiabilities: toNullableNumber(form.totalLiabilities),
        totalEquity: toNullableNumber(form.totalEquity),
        totalDebt: toNullableNumber(form.totalDebt),
        currentAssets: toNullableNumber(form.currentAssets),
        currentLiabilities: toNullableNumber(form.currentLiabilities),
        fcf: toNullableNumber(form.freeCashFlow),
        sourceDocumentRef: 'MANUAL_ENTRY',
      };

      await upsertFinancials.mutateAsync({ statements: [statement] });

      setForm(() => ({ ...EMPTY_FORM, periodType: 'annual' }));
      setSuccess('Financial statement saved successfully.');
      setTimeout(() => {
        setSuccess(null);
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to save financial statement.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            {initialStatement ? 'Edit Financial Statement' : 'Add Financial Statement'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Period Controls */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Period
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Period Type
                </label>
                <select
                  value={form.periodType}
                  onChange={handlePeriodChange}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fiscal Year
                </label>
                <input
                  type="text"
                  value={form.fiscalYear}
                  onChange={handleChange('fiscalYear')}
                  placeholder="e.g. 2024"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              {form.periodType === 'quarterly' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Fiscal Quarter
                  </label>
                  <select
                    value={form.fiscalQuarter}
                    onChange={handleChange('fiscalQuarter')}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Metric Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Income Statement */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                Income Statement
              </div>
              <div className="space-y-2">
                <MetricInput
                  label="Revenue"
                  value={form.revenue}
                  onChange={handleChange('revenue')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Operating Profit"
                  value={form.operatingProfit}
                  onChange={handleChange('operatingProfit')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Net Profit"
                  value={form.netProfit}
                  onChange={handleChange('netProfit')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="EPS"
                  value={form.eps}
                  onChange={handleChange('eps')}
                  suffix="₹"
                />
                <MetricInput
                  label="EBIT"
                  value={form.ebit}
                  onChange={handleChange('ebit')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Interest Expense"
                  value={form.interestExpense}
                  onChange={handleChange('interestExpense')}
                  suffix="₹ Cr"
                />
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                Balance Sheet
              </div>
              <div className="space-y-2">
                <MetricInput
                  label="Total Equity"
                  value={form.totalEquity}
                  onChange={handleChange('totalEquity')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Total Debt"
                  value={form.totalDebt}
                  onChange={handleChange('totalDebt')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Total Assets"
                  value={form.totalAssets}
                  onChange={handleChange('totalAssets')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Total Liabilities"
                  value={form.totalLiabilities}
                  onChange={handleChange('totalLiabilities')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Current Assets"
                  value={form.currentAssets}
                  onChange={handleChange('currentAssets')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Current Liabilities"
                  value={form.currentLiabilities}
                  onChange={handleChange('currentLiabilities')}
                  suffix="₹ Cr"
                />
              </div>
            </div>

            {/* Cash Flow & Efficiency */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                Cash Flow & Efficiency
              </div>
              <div className="space-y-2">
                <MetricInput
                  label="Operating Cash Flow (CFO)"
                  value={form.operatingCashFlow}
                  onChange={handleChange('operatingCashFlow')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Free Cash Flow (FCF)"
                  value={form.freeCashFlow}
                  onChange={handleChange('freeCashFlow')}
                  suffix="₹ Cr"
                />
                <MetricInput
                  label="Debtor Days"
                  value={form.debtorDays}
                  onChange={handleChange('debtorDays')}
                  suffix="days"
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
            Leave unknown fields blank — Stokiffy preserves missing data as <strong>null</strong>,
            never zero-coerced.
          </div>

          {error && (
            <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs">
              {success}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Save className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Statement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface MetricInputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suffix?: string;
}

function MetricInput({ label, value, onChange, suffix }: MetricInputProps) {
  return (
    <div className="space-y-1">
      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="-"
          className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
        />
        {suffix && (
          <span className="absolute right-2.5 top-1.5 text-[9px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
