'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  Upload,
  RotateCcw,
  Download,
} from 'lucide-react';
import { useImportPriceBars } from '@/hooks/use-manual-data';
import type { PriceBar } from '@stock-assistant/contracts';

interface ImportOHLCVModalProps {
  isOpen: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CSV_HELP = `date,open,high,low,close,volume
2024-01-02,3450.00,3480.00,3420.00,3470.00,1250000
2024-01-03,3470.00,3510.00,3460.00,3500.00,1100000`;

const OHLCV_TEMPLATE_HEADER = 'date,open,high,low,close,volume';
const OHLCV_TEMPLATE_ROWS = [
  '2024-01-02,3450.00,3480.00,3420.00,3470.00,1250000',
  '2024-01-03,3470.00,3510.00,3460.00,3500.00,1100000',
  '2024-01-04,3500.00,3540.00,3490.00,3530.00,1080000',
];

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadOhlcvTemplate() {
  const lines = [OHLCV_TEMPLATE_HEADER, ...OHLCV_TEMPLATE_ROWS];
  downloadCsv('stokiffy-ohlcv-template.csv', lines.join('\n'));
}

interface ParsedRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function ImportOHLCVModal({
  isOpen,
  companyId,
  onClose,
  onSuccess,
}: ImportOHLCVModalProps) {
  const [csvText, setCsvText] = useState(CSV_HELP);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importPriceBars = useImportPriceBars(companyId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const parseCsvText = (text: string): ParsedRow[] => {
    const lines = text.trim().split(/\r?\n/);
    const rows: ParsedRow[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('date,')) continue;
      const cols = trimmed.split(',');
      if (cols.length < 6) continue;
      rows.push({
        date: cols[0]?.trim() ?? '',
        open: Number(cols[1] ?? '0'),
        high: Number(cols[2] ?? '0'),
        low: Number(cols[3] ?? '0'),
        close: Number(cols[4] ?? '0'),
        volume: Number(cols[5] ?? '0'),
      });
    }
    return rows;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyId) {
      setError('No company selected.');
      return;
    }

    // If a file is uploaded, parse it and send as csvText so both paths hit the same JSON endpoint.
    let payloadText = csvText;
    if (file) {
      const text = await file.text();
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        setError('Could not parse any valid OHLCV rows from the file.');
        return;
      }
      payloadText = rows
        .map((r) => `${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}`)
        .join('\n');
    } else {
      const rows = parseCsvText(csvText);
      if (rows.length === 0) {
        setError('Please paste valid OHLCV CSV data.');
        return;
      }
    }

    setIsImporting(true);
    try {
      await importPriceBars.mutateAsync({ file: undefined, csvText: payloadText });
      setCsvText(CSV_HELP);
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'OHLCV import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const rowCount = parseCsvText(csvText).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            Import OHLCV CSV
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadOhlcvTemplate}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-cyan-400 border border-cyan-500/30 transition-colors"
            >
              <Download className="w-3 h-3 mr-1" />
              Template
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              CSV File (.csv)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            {file && (
              <p className="text-[10px] text-slate-400 font-mono">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Or paste CSV text
              </label>
              <button
                type="button"
                onClick={() => setCsvText(CSV_HELP)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-cyan-400 border border-cyan-500/30 transition-colors"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </button>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFile(null);
              }}
              rows={6}
              placeholder={CSV_HELP}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[10px] text-slate-500">
              Parsed {rowCount} row{rowCount !== 1 ? 's' : ''}.
              Expected header: date,open,high,low,close,volume
            </p>
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
              disabled={isImporting}
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <RotateCcw className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <FileText className="w-3.5 h-3.5 mr-1.5" />
              )}
              Import OHLCV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
