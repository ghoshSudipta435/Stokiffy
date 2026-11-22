'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  List,
  BarChart3,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useWatchlists } from '@/hooks/use-watchlists';
import { useWatchlistItems } from '@/hooks/use-watchlists';
import { useCompany } from '@/hooks/use-company';
import type { Watchlist, WatchlistItem } from '@stock-assistant/contracts';
import { formatINR } from '@/lib/formatters';

const STAGE_COLUMNS: Array<{ key: keyof WatchlistCompanyComparison; label: string }> = [
  { key: 'stageA', label: 'Stage A' },
  { key: 'stageB', label: 'Stage B' },
  { key: 'stageC', label: 'Stage C' },
  { key: 'stageD', label: 'Stage D' },
];

interface WatchlistCompanyComparison {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number | null;
  stageA: string;
  stageB: string;
  stageC: string;
  stageD: string;
  fairValue: string;
  maxBuyPrice: string;
  activeFlags: number;
  eligible: string;
}

function badgeForStatus(status: string | undefined) {
  const base = 'px-2 py-0.5 rounded text-[9px] font-mono border';
  switch (status) {
    case 'PASS':
      return `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/30`;
    case 'FAIL':
    case 'BLOCKED':
      return `${base} bg-red-500/10 text-red-400 border-red-500/30`;
    case 'PENDING':
    case 'NOT_EVALUATED':
    default:
      return `${base} bg-slate-800 text-slate-400 border-slate-700`;
  }
}

export default function WatchlistsPage() {
  const {
    watchlists,
    isLoadingWatchlists,
    createWatchlist,
    isCreatingWatchlist,
    deleteWatchlist,
    isDeletingWatchlist,
    addWatchlistItem,
    isAddingWatchlistItem,
    deleteWatchlistItem,
    isDeletingWatchlistItem,
  } = useWatchlists();

  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [addSymbol, setAddSymbol] = useState('');

  const { data: items = [], isLoading: itemsLoading } = useWatchlistItems(
    selectedWatchlistId ?? undefined
  );

  const selectedWatchlist = watchlists.find((w) => w.id === selectedWatchlistId);

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      const wl = await createWatchlist({ name: createName.trim() });
      setCreateName('');
      setSelectedWatchlistId(wl.id);
    } catch {
      // Error surfaced by API route
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWatchlistId || !addSymbol.trim()) return;
    try {
      // Resolve symbol → companyId via company detail endpoint
      const company = await fetchCompanyBySymbol(addSymbol.trim().toUpperCase());
      if (!company) return;
      await addWatchlistItem({
        watchlistId: selectedWatchlistId,
        body: { companyId: company.id },
      });
      setAddSymbol('');
    } catch {
      // Error surfaced by API route
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedWatchlistId) return;
    try {
      await deleteWatchlistItem({ watchlistId: selectedWatchlistId, itemId });
    } catch {
      // Error surfaced by API route
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    try {
      await deleteWatchlist(id);
      if (selectedWatchlistId === id) setSelectedWatchlistId(null);
    } catch {
      // Error surfaced by API route
    }
  };

  // Build comparison rows using company detail for stage/fair-value data
  const comparisonRows: WatchlistCompanyComparison[] = items.map((item) => {
    const company = item.company;
    return {
      symbol: company?.symbol ?? item.companyId,
      name: company?.name ?? '—',
      sector: company?.sector ?? '—',
      currentPrice: company?.currentPrice ?? null,
      stageA: '—',
      stageB: '—',
      stageC: '—',
      stageD: '—',
      fairValue: '—',
      maxBuyPrice: '—',
      activeFlags: 0,
      eligible: 'Not evaluated',
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Watchlists & Comparison
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create watchlists, track companies, and compare Stage A–D scores,
            fair value, and buy-readiness side by side.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoadingWatchlists ? (
        <div className="p-12 text-center text-slate-400 font-mono">
          <BarChart3 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading watchlists…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Watchlist management */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                Your Watchlists
              </h2>
              {watchlists.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">
                  No watchlists yet. Create one to start tracking companies.
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlists.map((wl) => {
                    const isActive = selectedWatchlistId === wl.id;
                    return (
                      <button
                        key={wl.id}
                        onClick={() => setSelectedWatchlistId(wl.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded border text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 border-l-2 border-cyan-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <List className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[140px]">{wl.name}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-mono">
                          {wl.itemCount ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                Create Watchlist
              </h2>
              <form onSubmit={handleCreateWatchlist} className="space-y-3">
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Watchlist name (e.g. Large-Cap IT)"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingWatchlist || !createName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingWatchlist ? (
                    <Plus className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  <span>Create</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right: Selected watchlist items + comparison */}
          <div className="lg:col-span-8 space-y-4">
            {!selectedWatchlistId ? (
              <div className="p-12 rounded-lg bg-slate-900 border border-slate-800 text-center">
                <List className="w-10 h-10 text-slate-600/50 mx-auto mb-3" />
                <h2 className="text-sm font-bold text-slate-200 mb-1">
                  Select a watchlist
                </h2>
                <p className="text-xs text-slate-400">
                  Choose a watchlist from the left panel to view its companies and comparison table.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-200">
                      {selectedWatchlist?.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {items.length} company(ies) tracked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteWatchlist(selectedWatchlistId!)}
                      disabled={isDeletingWatchlist}
                      className="px-3 py-1.5 rounded bg-red-950/40 border border-red-800/60 text-red-300 hover:bg-red-900/40 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {isDeletingWatchlist ? 'Deleting...' : 'Delete Watchlist'}
                    </button>
                  </div>
                </div>

                {/* Add company form */}
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                  <form onSubmit={handleAddCompany} className="flex items-end gap-2">
                    <input
                      type="text"
                      value={addSymbol}
                      onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                      placeholder="Add company symbol (e.g. TCS)"
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={isAddingWatchlistItem || !addSymbol.trim() || !selectedWatchlistId}
                      className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingWatchlistItem ? 'Adding...' : 'Add'}
                    </button>
                  </form>
                </div>

                {/* Comparison table */}
                <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Comparison Table — {items.length} Company{(items.length !== 1 ? 'ies' : '')}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Stage A–D scores, fair value, max buy price (20% MOS), active flags, and stage
                      eligibility side by side.
                    </p>
                  </div>

                  {itemsLoading ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Loading comparison data…
                    </div>
                  ) : items.length === 0 ? (
                    <div className="px-8 py-10 text-center text-slate-500 text-xs">
                      No companies in this watchlist. Add a symbol above to begin tracking.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Symbol</th>
                            <th className="py-2.5 px-3">Company</th>
                            <th className="py-2.5 px-3">Sector</th>
                            <th className="py-2.5 px-3 text-right">CMP</th>
                            {STAGE_COLUMNS.map((c) => (
                              <th key={c.key} className="py-2.5 px-2 text-center">
                                {c.label}
                              </th>
                            ))}
                            <th className="py-2.5 px-2 text-right">Fair Value</th>
                            <th className="py-2.5 px-2 text-right">Max Buy (20% MOS)</th>
                            <th className="py-2.5 px-2 text-center">Flags</th>
                            <th className="py-2.5 px-2 text-center">Eligible</th>
                            <th className="py-2.5 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {comparisonRows.map((row) => (
                            <tr
                              key={row.symbol}
                              className="hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-bold text-cyan-400 truncate">
                                <Link href={`/companies/${row.symbol}`} className="hover:underline">
                                  {row.symbol}
                                </Link>
                              </td>
                              <td className="py-2.5 px-3 font-sans text-slate-300 truncate max-w-[120px]">
                                {row.name}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 truncate">
                                {row.sector}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-200">
                                {row.currentPrice !== null ? formatINR(row.currentPrice) : '—'}
                              </td>
                              {STAGE_COLUMNS.map((c) => (
                                <td key={c.key} className="py-2.5 px-2 text-center">
                                  <span className={badgeForStatus(row[c.key] as string)}>
                                    {row[c.key]}
                                  </span>
                                </td>
                              ))}
                              <td className="py-2.5 px-2 text-right text-slate-400">
                                {row.fairValue}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-400">
                                {row.maxBuyPrice}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                  row.activeFlags > 0
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                }`}>
                                  {row.activeFlags}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                  row.eligible === 'Eligible'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {row.eligible}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => handleRemoveItem(itemIdFromSymbol(row.symbol, items))}
                                  className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                  title="Remove from watchlist"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Resolve symbol to company detail via direct fetch (avoids hook rules in loops)
async function fetchCompanyBySymbol(symbol: string) {
  try {
    const response = await fetch(
      `/api/v1/companies/${encodeURIComponent(symbol)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const json = await response.json();
    return json.data;
  } catch {
    return null;
  }
}

function itemIdFromSymbol(symbol: string, items: WatchlistItem[]) {
  const found = items.find((i) => i.company?.symbol === symbol);
  return found?.id ?? '';
}
