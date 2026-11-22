'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Filter,
  TrendingUp,
  ShieldAlert,
  Calculator,
  Crosshair,
  PieChart,
  Activity,
  BookOpen,
  Settings,
  UploadCloud,
  List,
  LogOut,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Stage A: Screener', href: '/screener', icon: Filter },
  { name: 'Watchlists', href: '/watchlists', icon: List, badge: '0' },
  { name: 'Stage E: Trade Planner', href: '/trade-planner', icon: Crosshair },
  { name: 'Stage F: Portfolio Risk', href: '/portfolio', icon: PieChart },
  { name: 'Stage G: Monitoring & Exit', href: '/monitoring', icon: Activity },
];

const SECONDARY_NAV: NavItem[] = [
  { name: 'Investment Journal', href: '/journal', icon: BookOpen },
  { name: 'System Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between select-none">
      <div>
        {/* Workstation Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-7 h-7 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm">
            S
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide text-slate-100">STOKIFFY</span>
            <span className="block text-[10px] text-cyan-400/80 uppercase font-mono tracking-wider">
              Research Terminal
            </span>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="p-3 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Lifecycle Workstation
            </div>
            <nav className="space-y-1">
              {PRIMARY_NAV.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Operations & Audit
            </div>
            <nav className="space-y-1">
              {SECONDARY_NAV.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 font-semibold border-l-2 border-cyan-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Account & Sign Out */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-950/20 transition-colors group"
              title="Sign out of workstation"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-rose-400 transition-colors" />
                <span>Lock Terminal</span>
              </div>
              <span className="text-[10px] font-mono text-slate-600 group-hover:text-rose-400/80">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Footer Status */}
      <div className="p-4 border-t border-slate-800 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span>Engine Status</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVE
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          v1.0.0-rc1 • NSE/BSE
        </div>
      </div>
    </aside>
  );
}
