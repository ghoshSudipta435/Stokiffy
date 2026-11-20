import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-lg text-center shadow-xl">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-slate-800 text-cyan-400 font-mono text-xl font-bold">
          404
        </div>
        <h2 className="text-xl font-semibold mb-2">Resource Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">
          The requested company, analysis snapshot, or page does not exist in the Stokiffy workstation.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
