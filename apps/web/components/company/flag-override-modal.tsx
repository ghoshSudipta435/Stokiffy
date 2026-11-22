'use client';

import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { RedFlagDTO } from '@/app/api/v1/flags/route';

interface FlagOverrideModalProps {
  flag: RedFlagDTO;
  isOpen: boolean;
  onClose: () => void;
  onAcknowledged: () => void;
}

export function FlagOverrideModal({
  flag,
  isOpen,
  onClose,
  onAcknowledged,
}: FlagOverrideModalProps) {
  const [reason, setReason] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsAcknowledging(true);
    try {
      await apiClient.post(
        `/api/v1/flags/${encodeURIComponent(flag.id)}/acknowledge`,
        { reason }
      );
      onAcknowledged();
      onClose();
    } catch {
      // Error handled by API route
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Acknowledge / Override Flag
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Flag</div>
            <div className="text-sm text-slate-200 font-mono">{flag.code}</div>
            <div className="text-xs text-slate-400 mt-1">{flag.title}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                flag.severity === 'HARD'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {flag.severity}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700">
                {flag.status}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-300 mb-2">
              Rationale / Justification
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are acknowledging or overriding this flag..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-cyan-500 min-h-[100px] resize-y"
            />
          </div>

          <div className="text-xs text-slate-500 mb-4">
            Acknowledging preserves the original flag as auditable history and creates an AuditEvent record.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAcknowledge}
            disabled={!reason.trim() || isAcknowledging}
            className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAcknowledging ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <FileText className="w-3.5 h-3.5 mr-2" />
            )}
            Acknowledge Flag
          </button>
        </div>
      </div>
    </div>
  );
}
