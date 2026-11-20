'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  UploadCloud,
  FileSpreadsheet,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useScreener } from '@/hooks/use-screener';
import { useFlags } from '@/hooks/use-flags';
import { RedFlagIndicator } from '@/components/shared/red-flag-indicator';

export default function ScreenerPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'FLAGS'>('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const { data: companiesData, isLoading, refetch } = useScreener({
    q: searchTerm || undefined,
    sector: selectedSector || undefined,
  });

  const { data: flagsData } = useFlags();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', 'GENERIC_CSV');

    try {
      const res = await fetch('/api/v1/ingestion/upload-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`File accepted and staged! Background Job Ticket: ${data.data.jobId}.`);
        refetch();
      } else {
        setUploadStatus(`Upload validation failed: ${data.error?.message || 'Invalid format'}`);
      }
    } catch {
      setUploadStatus('Upload request failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const companies = companiesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Screening & Research Workstation (UI Shell)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data table scaffolding and CSV staging. Financial calculation engines are in packages/core.
          </p>
        </div>

        {/* CSV Ingestion Button */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-semibold text-xs transition-colors">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Stage CSV for Ingestion'}</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* Scope Notice */}
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-slate-100">Policy & Engine Status Notice:</strong>
          <p className="mt-1 text-slate-400">
            Stage A market cap thresholds (Decision 1), liquidity cutoffs (Decision 2), promoter pledge limits (Decision 3),
            minimum ROCE (Decision 4), and maximum debt-to-equity (Decision 5) are strictly PENDING USER DECISION.
            Companies listed below are demonstration fixtures for layout validation.
          </p>
        </div>
      </div>

      {uploadStatus && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded text-cyan-200 text-xs flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Tabs & Search Filter Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-lg bg-slate-900 border border-slate-800">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Tracked Fixtures ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab('FLAGS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'FLAGS'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Audit Flags Register ({flagsData?.length || 0})
          </button>
        </div>

        {/* Filter inputs */}
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search symbol or name..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Sectors</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Financial Services">Financial Services</option>
            <option value="Energy">Energy</option>
            <option value="Consumer Discretionary">Consumer Discretionary</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh universe"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'FLAGS' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-sm font-bold text-slate-200 mb-1">
              Active Audit Flags Register (Neutral Technical View)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Presents logged flag items. Flag override and acknowledgment policies remain pending user decision.
            </p>

            <div className="space-y-3">
              {flagsData?.map((flag) => (
                <div key={flag.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <RedFlagIndicator
                        severity={flag.severity}
                        code={flag.code}
                        title={`${flag.symbol}: ${flag.title}`}
                        status={flag.status}
                      />
                      <div className="mt-2 text-xs text-slate-400 pl-11">
                        <div>
                          <strong className="text-slate-300">Indicator:</strong>{' '}
                          {flag.evidence.indicator}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {flag.evidence.description}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Demonstration Item
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Companies Screening Table */
        <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Exchange</th>
                  <th className="py-3 px-4">Sector</th>
                  <th className="py-3 px-4 text-center">Stage A Status</th>
                  <th className="py-3 px-4 text-center">Engine Integration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading tracked fixtures...
                    </td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No companies match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  companies.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-cyan-400">
                        <Link href={`/companies/${c.symbol}`} className="hover:underline">
                          {c.symbol}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-200">
                        {c.name}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{c.exchange}</td>
                      <td className="py-3 px-4 font-sans text-slate-400">{c.sector}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          NOT_EVALUATED
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-amber-400 text-[10px]">
                        PENDING_CORE_ENGINE
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
