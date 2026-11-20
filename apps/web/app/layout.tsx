import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';

export const metadata: Metadata = {
  title: 'Stokiffy — Personal Stock Market Assistant',
  description: 'Deterministic equity research, lifecycle analysis, and portfolio risk management for Indian equities.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
