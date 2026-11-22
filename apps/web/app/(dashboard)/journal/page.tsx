'use client';

import React, { useState, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Tag,
  Calendar,
  FileText,
  Trash2,
} from 'lucide-react';
import { useJournal } from '@/hooks/use-journal';
import { useScreener } from '@/hooks/use-screener';
import { useTradePlans } from '@/hooks/use-trade-plans';
import { formatINR, formatPercent, formatDateIST } from '@/lib/formatters';

const ACTION_LABELS: Record<string, string> = {
  buy: 'BUY',
  trim: 'TRIM',
  sell: 'SELL',
};

const ACTION_COLORS: Record<string, string> = {
  buy: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  trim: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
  sell: 'bg-red-500/10 text-red-400 border border-red-500/30',
};

function JournalEntryRow({
  entry,
  onReview,
}: {
  entry: any;
  onReview: (id: string) => void;
}) {
  return (
    <div key={entry.id} className="px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${ACTION_COLORS[entry.action]}`}>
            {ACTION_LABELS[entry.action]}
          </span>
          <a
            href={`/companies/${entry.symbol ?? entry.companyId ?? ''}`}
            className="text-xs font-bold text-cyan-400 hover:underline"
          >
            {entry.symbol ?? entry.companyId ?? '—'}
          </a>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDateIST(entry.date)}
          </span>
          {entry.review ? (
            <span className="px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-800/40 text-[9px]">
              Reviewed
            </span>
          ) : null}
        </div>
      </div>

      <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800/80 leading-relaxed mb-2">
        <div className="font-semibold text-slate-400 mb-1">Reason:</div>
        {entry.reason}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-1">
        <span>
          Qty {entry.quantity} @ {formatINR(entry.price)} {'•'}
          Fees {formatINR(entry.fees)} {'•'} Taxes {formatINR(entry.taxes)}
        </span>
        {entry.realisedPnl !== null && entry.realisedPnl !== undefined && (
          <span className={`font-mono ${entry.realisedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            Realised P&L {entry.realisedPnl >= 0 ? '+' : ''}{formatINR(entry.realisedPnl)}
          </span>
        )}
      </div>

      {!entry.review && (
        <button
          onClick={() => onReview(entry.id)}
          className="px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
        >
          <FileText className="w-3 h-3 mr-1" />
          Add Post-Trade Review
        </button>
      )}
    </div>
  );
}

export default function JournalPage() {
  const {
    journalEntries,
    isLoadingJournal,
    createJournalEntry,
    isCreatingJournalEntry,
    appendJournalReview,
    isAppendingReview,
  } = useJournal();
  const { data: screenerData } = useScreener({ limit: 100 });
  const { tradePlans } = useTradePlans();

  const companies = screenerData?.data ?? [];

  // Log execution form state
  const [action, setAction] = useState<'buy' | 'trim' | 'sell'>('buy');
  const [companyId, setCompanyId] = useState('');
  const [tradePlanId, setTradePlanId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [taxes, setTaxes] = useState('0');
  const [reason, setReason] = useState('');

  // Review modal state
  const [reviewEntryId, setReviewEntryId] = useState<string | null>(null);
  const [reviewQuality, setReviewQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [reviewLesson, setReviewLesson] = useState('');
  const [reviewBehavioural, setReviewBehavioural] = useState('');
  const [reviewSlippage, setReviewSlippage] = useState('');
  const [reviewRulesWorked, setReviewRulesWorked] = useState('');
  const [reviewAssumptionsFailed, setReviewAssumptionsFailed] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedCompany = companies.find((c) => c.id === companyId);

  const handleLogExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!tradePlanId || !companyId || !quantity || !price || !reason) {
      setSubmitError('Trade plan, company, quantity, price and reason are required.');
      return;
    }
    if (reason.length < 5) {
      setSubmitError('Reason must contain at least 5 characters.');
      return;
    }
    try {
      await createJournalEntry({
        tradePlanId,
        companyId,
        symbol: selectedCompany?.symbol ?? '',
        date: new Date().toISOString(),
        action,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        fees: parseFloat(fees) || 0,
        taxes: parseFloat(taxes) || 0,
        reason,
      });
      setQuantity('');
      setPrice('');
      setReason('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to log execution.');
    }
  };

  const handleAppendReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewEntryId) return;
    if (reviewLesson.length < 5) {
      setSubmitError('Lesson must contain at least 5 characters.');
      return;
    }
    try {
      await appendJournalReview({
        id: reviewEntryId,
        body: {
          review: {
            rulesWorked: reviewRulesWorked.split(',').map((s) => s.trim()).filter(Boolean),
            assumptionsFailed: reviewAssumptionsFailed.split(',').map((s) => s.trim()).filter(Boolean),
            executionQuality: reviewQuality,
            slippage: parseFloat(reviewSlippage) || 0,
            behaviouralNotes: reviewBehavioural,
            lesson: reviewLesson,
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'owner_user_01',
          },
        },
      });
      setReviewEntryId(null);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to append review.');
    }
  };

  if (isLoadingJournal) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <BookOpen className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading journal…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Investment Decision Journal & Post-Mortem Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable decision log • Thesis tracking • Behavioral audit & quarterly reviews.
          </p>
        </div>
      </div>

      {submitError && (
        <div className="p-3 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {submitError}
        </div>
      )}

      {/* Log Execution Form */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Log Execution</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">
            Original execution records are immutable
          </span>
        </div>

        <form onSubmit={handleLogExecution} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as 'buy' | 'trim' | 'sell')}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="buy">BUY</option>
                <option value="trim">TRIM</option>
                <option value="sell">SELL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Trade Plan ID</label>
              <select
                value={tradePlanId}
                onChange={(e) => setTradePlanId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select trade plan</option>
                {tradePlans.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.symbol} — {tp.status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Price (INR)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fees</label>
              <input
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                step="0.01"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Taxes</label>
              <input
                type="number"
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                step="0.01"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Reason <span className="text-red-400">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Execution rationale (min 5 chars)..."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">{reason.length}/5 min</p>
          </div>
          <button
            type="submit"
            disabled={isCreatingJournalEntry}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
          >
            {isCreatingJournalEntry ? (
              <Plus className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Log Execution</span>
          </button>
        </form>
      </div>

      {/* Journal Entries */}
      <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-200">Journal Entries ({journalEntries.length})</h2>
        </div>

        <div className="divide-y divide-slate-800/60">
          {journalEntries.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-500 text-xs">
              No journal entries yet. Log your first execution above.
            </div>
          ) : (
            journalEntries.map((entry) => <JournalEntryRow key={entry.id} entry={entry} onReview={setReviewEntryId} />)
          )}
        </div>
      </div>

      {/* Post-Trade Review Modal */}
      {reviewEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setReviewEntryId(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Add Post-Trade Review
              </h3>
              <button
                onClick={() => setReviewEntryId(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAppendReview} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Execution Quality
                </label>
                <div className="flex gap-2">
                  {(['good', 'fair', 'poor'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setReviewQuality(q)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        reviewQuality === q
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Lesson Learned <span className="text-red-400">*</span></label>
                <textarea
                  value={reviewLesson}
                  onChange={(e) => setReviewLesson(e.target.value)}
                  rows={3}
                  placeholder="What did this trade teach you? (min 5 chars)..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">{reviewLesson.length}/5 min</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Rules That Worked</label>
                  <input
                    value={reviewRulesWorked}
                    onChange={(e) => setReviewRulesWorked(e.target.value)}
                    placeholder="e.g. position sizing, stop discipline"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Assumptions That Failed</label>
                  <input
                    value={reviewAssumptionsFailed}
                    onChange={(e) => setReviewAssumptionsFailed(e.target.value)}
                    placeholder="e.g. earnings growth estimate"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Behavioural Notes</label>
                <textarea
                  value={reviewBehavioural}
                  onChange={(e) => setReviewBehavioural(e.target.value)}
                  rows={2}
                  placeholder="Emotional state, biases observed..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Slippage (%)</label>
                <input
                  type="number"
                  value={reviewSlippage}
                  onChange={(e) => setReviewSlippage(e.target.value)}
                  step="0.01"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                Note: The original execution record is immutable. This review is appended as a separate auditable entry.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setReviewEntryId(null)}
                  className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAppendingReview || reviewLesson.length < 5}
                  className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAppendingReview ? 'Saving...' : 'Save Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
