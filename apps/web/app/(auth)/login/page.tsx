'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('investor@stokiffy.local');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setError('Please enter your workstation master passphrase.');
      return;
    }
    // In personal workstation mode, authenticate and proceed to dashboard
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">STOKIFFY</h1>
            <p className="text-xs text-slate-400">Personal Financial Research Workstation</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 text-red-200 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Investor Account
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Workstation Passphrase
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm rounded transition-colors shadow-lg shadow-cyan-950/50"
            >
              Access Workstation
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-500">
            Personal Mode Active • Single Owner Profile • NSE/BSE Equities
          </p>
        </div>
      </div>
    </div>
  );
}
