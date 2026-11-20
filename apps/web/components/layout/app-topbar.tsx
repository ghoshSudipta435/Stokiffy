'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, AlertTriangle, ShieldAlert, Clock, User } from 'lucide-react';
import { formatDateTimeIST } from '@/lib/formatters';

export function AppTopbar() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    router.push(`/companies/${searchTerm.trim().toUpperCase()}`);
  };

  // Indian Stock Market Hours: 09:15 to 15:30 IST, Monday-Friday
  const getMarketStatus = () => {
    if (!currentTime) return { text: 'CHECKING', color: 'text-slate-400', bg: 'bg-slate-800' };
    
    // Convert to IST
    const istTimeStr = currentTime.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric',
    });
    const istDay = currentTime.toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    });

    const isWeekend = istDay === 'Sat' || istDay === 'Sun';
    const [hours, minutes] = istTimeStr.split(':').map(Number);
    const totalMinutes = (hours || 0) * 60 + (minutes || 0);
    const isOpen = !isWeekend && totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;

    if (isOpen) {
      return { text: 'NSE/BSE OPEN', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    }
    return { text: 'MARKET CLOSED', color: 'text-amber-400', bg: 'bg-amber-500/10' };
  };

  const market = getMarketStatus();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between select-none">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-80 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search ticker (e.g. TCS, INFY)..."
          className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 uppercase font-mono"
        />
      </form>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-slate-300">
            {currentTime ? formatDateTimeIST(currentTime) : 'Loading IST...'}
          </span>
        </div>

        <div className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${market.bg} ${market.color} border border-current/20`}>
          {market.text}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Red Flags Alert Counter */}
        <button
          onClick={() => router.push('/screener?tab=flags')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/40 border border-red-800/60 text-red-300 hover:bg-red-900/40 text-xs font-medium transition-colors"
          title="Active Red Flags in Tracked Universe"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span>1 Active Flag</span>
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-200 leading-none">Investor</div>
            <div className="text-[10px] text-slate-500 font-mono">Personal Owner</div>
          </div>
        </div>
      </div>
    </header>
  );
}
