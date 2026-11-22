'use client';

import React, { useState, useCallback } from 'react';
import {
  Plus,
  X,
  Building2,
  MapPin,
  Film,
  Search,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useCreateCompany } from '@/hooks/use-manual-data';
import { useMarketDataSearch, useSyncOhlcv } from '@/hooks/use-market-data';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EXCHANGE_MAP: Record<string, 'NSE' | 'BSE'> = {
  NSE: 'NSE',
  BSE: 'BSE',
};

export function AddCompanyModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCompanyModalProps) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [sector, setSector] = useState('');
  const [industry, setIndustry] = useState('');
  const [isin, setIsin] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { symbol: string; name: string; exchange: string; sector: string; industry: string }[]
  >([]);
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);

  const createCompany = useCreateCompany();
  const search = useMarketDataSearch(searchQuery);
  const syncOhlcv = useSyncOhlcv();

  const isSearching = search.isLoading;
  const results = search.data ?? [];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSearchResultsOpen(e.target.value.trim().length >= 2);
  };

  const handleSelectResult = (result: {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    industry: string;
  }) => {
    setSymbol(result.symbol);
    setName(result.name);
    setExchange(
      (EXCHANGE_MAP[result.exchange.toUpperCase()] ?? 'NSE') as 'NSE' | 'BSE'
    );
    setSector(result.sector);
    setIndustry(result.industry);
    setSearchQuery(result.symbol);
    setSearchResultsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!symbol || !name || !sector || !industry) {
      setError('Symbol, name, sector and industry are required.');
      return;
    }
    setIsCreating(true);
    try {
      const created = await createCompany.mutateAsync({
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        exchange,
        sector: sector.trim(),
        industry: industry.trim(),
        isin: isin.trim() || undefined,
      });

      // Auto-sync 1 year of daily OHLCV prices after adding (when enabled).
      if (autoSync && created.id) {
        try {
          const syncResult = await syncOhlcv.mutateAsync({
            companyId: created.id,
            symbol: created.symbol,
            exchange,
            days: 365,
          });
          if (syncResult) {
            setError(null);
          }
        } catch {
          // Non-fatal: company was created even if OHLCV sync failed.
        }
      }

      setSymbol('');
      setName('');
      setSector('');
      setIndustry('');
      setIsin('');
      setAutoSync(true);
      setSearchQuery('');
      setSearchResultsOpen(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create company.');
    } finally {
      setIsCreating(false);
    }
  };

  const isDisabled =
    isCreating ||
    syncOhlcv.isPending ||
    !symbol ||
    !name ||
    !sector ||
    !industry;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Add Company
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* NSE/BSE Live Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Search NSE/BSE Stock (Yahoo Finance)
              </label>
              {isSearching && (
                <Clock className="w-3 h-3 text-slate-500 animate-spin" />
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Type symbol or name (2+ chars)..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            {searchResultsOpen && results.length > 0 && (
              <div className="absolute z-20 w-full mt-1 rounded-lg bg-slate-900 border border-slate-800 shadow-lg max-h-48 overflow-y-auto">
                {results.map((result) => (
                  <button
                    key={`${result.symbol}-${result.exchange}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-b-0"
                  >
                    <div className="font-mono text-slate-200 text-[10px]">
                      {result.symbol} ({result.exchange})
                    </div>
                    <div className="text-slate-400 text-[10px] truncate">
                      {result.name}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {result.sector} / {result.industry}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Symbol
            </label>
            <input
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setSearchQuery(e.target.value);
              }}
              placeholder="e.g. TCS"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 uppercase font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Company Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tata Consultancy Services Ltd."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Exchange
              </label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value as 'NSE' | 'BSE')}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                ISIN (optional)
              </label>
              <input
                value={isin}
                onChange={(e) => setIsin(e.target.value)}
                placeholder="INE467B01029"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 uppercase font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Sector
            </label>
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. Information Technology"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Industry
            </label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. IT Services"
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="auto-sync"
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="w-3 h-3 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <label
              htmlFor="auto-sync"
              className="text-xs text-slate-300 cursor-pointer select-none"
            >
              Auto-sync 1 year of daily OHLCV prices after adding (Yahoo Finance)
            </label>
          </div>

          {error && (
            <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDisabled}
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || syncOhlcv.isPending ? (
                <Plus className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-1.5" />
              )}
              Add Company
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
