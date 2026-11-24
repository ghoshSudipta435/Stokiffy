'use client';

import type { StageARunResponse } from '@/app/api/v1/analyses/stage-a/route';
import type { StageBRunResponse } from '@/app/api/v1/analyses/stage-b/route';
import type { StageCRunResponse } from '@/app/api/v1/companies/[id]/moat-assessments/route';
import type { StageDRunResponse } from '@/app/api/v1/companies/[id]/valuations/route';
import type { StageERunResponse } from '@/app/api/v1/analyses/stage-e/route';
import type { RedFlagDTO } from '@/app/api/v1/flags/route';
import type { CompanyDetailDTO } from '@/app/api/v1/companies/[id]/route';
import { formatINR, formatPercent, formatDateIST } from '@/lib/formatters';

const nz = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : v.toString();

const pct = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1)}%`;
};

export function exportMemo({
  company,
  stageARun,
  stageBRun,
  stageCRun,
  stageDRun,
  stageERun,
  activeFlags,
}: {
  company: CompanyDetailDTO;
  stageARun?: StageARunResponse | null;
  stageBRun?: StageBRunResponse | null;
  stageCRun?: StageCRunResponse | null;
  stageDRun?: StageDRunResponse | null;
  stageERun?: StageERunResponse | null;
  activeFlags?: RedFlagDTO[];
}) {
  const today = new Date().toISOString().split('T')[0];
  const fileName = `${company.symbol.toUpperCase()}-investment-memo-${today}.md`;

  const lines: string[] = [];

  lines.push(`# Investment Memo — ${company.symbol}`);
  lines.push('');
  lines.push(`**Company:** ${company.name}`);
  lines.push(`**Symbol:** ${company.symbol}`);
  lines.push(`**Exchange:** ${company.exchange}`);
  lines.push(`**ISIN:** ${company.isin}`);
  lines.push(`**Sector / Industry:** ${company.sector} / ${company.industry}`);
  lines.push(`**Generated:** ${formatDateIST(new Date().toISOString())}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ---- Stage A ----
  lines.push('## Stage A — Quick Screening');
  lines.push('');
  if (stageARun) {
    lines.push(`- **Verdict:** ${stageARun.verdictBand} (${stageARun.totalPoints} / ${stageARun.maxPoints})`);
    lines.push(`- **Gate:** ${stageARun.gatePassed ? 'PASSED — Eligible for Stage B' : 'BLOCKED'}`);
    lines.push(`- **Message:** ${stageARun.message}`);
    if (stageARun.hardStopCount > 0) {
      lines.push(`- **Hard Stops:** ${stageARun.hardStopCount}`);
    }
  } else {
    lines.push('*Not yet run.*');
  }
  lines.push('');

  // ---- Stage B ----
  lines.push('## Stage B — Deep Trend Analysis');
  lines.push('');
  if (stageBRun) {
    lines.push(`- **Verdict:** ${stageBRun.verdictBand} (${stageBRun.totalPoints} / ${stageBRun.maxPoints})`);
    lines.push(`- **Gate:** ${stageBRun.gatePassed ? 'PASSED — Eligible for Stage C' : 'BLOCKED'}`);
    lines.push(`- **Message:** ${stageBRun.message}`);
    if (stageBRun.hardStopCount > 0) {
      lines.push(`- **Hard Stops:** ${stageBRun.hardStopCount}`);
    }
    if (stageBRun.forensicFlags && stageBRun.forensicFlags.length > 0) {
      lines.push(`- **Forensic Flags:** ${stageBRun.forensicFlags.join(', ')}`);
    }
  } else {
    lines.push('*Not yet run.*');
  }
  lines.push('');

  // ---- Stage C ----
  lines.push('## Stage C — Business Model & Moat');
  lines.push('');
  if (stageCRun) {
    lines.push(`- **Moat Score:** ${stageCRun.moatScore} / ${stageCRun.maxPossibleScore}`);
    lines.push(`- **Moat Pass:** ${stageCRun.moatPass ? 'YES' : 'NO'}`);
    lines.push(`- **Overall Confidence:** ${stageCRun.overallConfidence}`);
    lines.push(`- **Gate:** ${stageCRun.gatePassed ? 'PASSED — Eligible for Stage D' : 'BLOCKED'}`);
    lines.push(`- **Message:** ${stageCRun.message}`);
    if (stageCRun.evidenceGaps && stageCRun.evidenceGaps.length > 0) {
      lines.push(`- **Evidence Gaps:** ${stageCRun.evidenceGaps.join('; ')}`);
    }
  } else {
    lines.push('*Not yet run.*');
  }
  lines.push('');

  // ---- Stage D ----
  lines.push('## Stage D — Valuation');
  lines.push('');
  if (stageDRun) {
    lines.push(`- **Primary Method:** ${stageDRun.primaryMethod}`);
    lines.push(`- **Selected Fair Value:** ${formatINR(stageDRun.selectedFairValue)}`);
    lines.push(`- **Valuation Range:** ${formatINR(stageDRun.valuationRange.low)} – ${formatINR(stageDRun.valuationRange.high)}`);
    lines.push(`- **Max Buy Price (20% MOS):** ${formatINR(stageDRun.maxBuyPrice)}`);
    lines.push(`- **Margin of Safety:** ${stageDRun.marginOfSafetyPct}%`);
    lines.push(`- **Buy Ready:** ${stageDRun.buyReady ? 'YES' : 'NO'}`);
    lines.push(`- **Confidence:** ${stageDRun.overallConfidence}`);
    lines.push(`- **Gate:** ${stageDRun.gatePassed ? 'PASSED — Eligible for Stage E' : 'BLOCKED'}`);
    lines.push(`- **Message:** ${stageDRun.message}`);
  } else {
    lines.push('*Not yet run.*');
  }
  lines.push('');

  // ---- Stage E ----
  lines.push('## Stage E — Technical Entry & Timing');
  lines.push('');
  if (stageERun) {
    lines.push(`- **Eligible:** ${stageERun.eligible ? 'YES' : 'NO'}`);
    lines.push(`- **Gate:** ${stageERun.gatePassed ? 'PASSED — Eligible for Stage F' : 'BLOCKED'}`);
    lines.push(`- **Current Price:** ${formatINR(stageERun.currentPrice)}`);
    lines.push(`- **Max Buy Price:** ${formatINR(stageERun.maxBuyPrice)}`);
    lines.push(`- **In Buy Zone:** ${stageERun.inBuyZone ? 'YES' : 'NO'}`);
    lines.push(`- **Daily Trend:** ${stageERun.technicalContext.dailyTrend}`);
    lines.push(`- **Weekly Trend:** ${stageERun.technicalContext.weeklyTrend}`);
    lines.push(`- **SMA 20 / 50 / 200:** ${stageERun.technicalContext.sma20?.toFixed(2) ?? '—'} / ${stageERun.technicalContext.sma50?.toFixed(2) ?? '—'} / ${stageERun.technicalContext.sma200?.toFixed(2) ?? '—'}`);
    lines.push(`- **ATR(14):** ${stageERun.technicalContext.atr14?.toFixed(2) ?? '—'}`);
    lines.push(`- **Volume Ratio:** ${stageERun.technicalContext.volumeRatio?.toFixed(2) ?? '—'}x`);

    const supports = stageERun.technicalContext.keyLevels.support ?? [];
    const resistances = stageERun.technicalContext.keyLevels.resistance ?? [];
    if (supports.length > 0) {
      lines.push(`- **Support Levels:** ${supports.map((s) => formatINR(s)).join(', ')}`);
    }
    if (resistances.length > 0) {
      lines.push(`- **Resistance Levels:** ${resistances.map((r) => formatINR(r)).join(', ')}`);
    }

    if (stageERun.bestSetup) {
      lines.push('');
      lines.push('### Best Setup');
      lines.push(`- **Pattern:** ${stageERun.bestSetup.pattern}`);
      lines.push(`- **Entry Zone:** ${formatINR(stageERun.bestSetup.entryZone.low)} – ${formatINR(stageERun.bestSetup.entryZone.high)}`);
      lines.push(`- **Invalidation / Stop:** ${formatINR(stageERun.bestSetup.invalidationLevel)}`);
      lines.push(`- **Target(s):** ${stageERun.bestSetup.targets.map((t) => formatINR(t)).join(', ')}`);
      lines.push(`- **Risk:Reward:** ${stageERun.bestSetup.riskReward.toFixed(2)}:1`);
      lines.push(`- **Setup Quality:** ${stageERun.bestSetup.setupQuality}`);
    }
  } else {
    lines.push('*Not yet run.*');
  }
  lines.push('');

  // ---- Red Flags ----
  lines.push('## Active Red Flags');
  lines.push('');
  const flags = (activeFlags ?? []).filter((f) => f.status === 'ACTIVE');
  if (flags.length > 0) {
    for (const flag of flags) {
      lines.push(`- **${flag.code}** (${flag.severity}) — ${flag.title}`);
    }
  } else {
    lines.push('*No active red flags.*');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*Generated by Stokiffy Workstation. Not investment advice.*');

  const md = lines.join('\n');

  // Trigger client-side download
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
