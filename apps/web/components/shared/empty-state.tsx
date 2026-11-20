import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
