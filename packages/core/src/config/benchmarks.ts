/**
 * Default Industry Benchmarks Configuration
 * 
 * Provides reference thresholds for Operating Profit Margin (OPM),
 * Industry Median P/E, and Minimum ROA across sectors.
 */

export interface IndustryBenchmark {
  industry: string;
  opmMin?: number;    // Lower bound of OPM in percent (e.g., 22 for 22%)
  opmMax?: number;    // Upper bound of OPM in percent (e.g., 28 for 28%)
  peMedian?: number;  // Median/benchmark P/E (e.g., 20)
  minRoa?: number;    // Minimum ROA in percent (e.g., 20 for 20%, 0.8 for 0.8%)
}

/**
 * Standard industry benchmark registry.
 * Values reflect Indian equity market norms (NSE/BSE).
 */
export const DEFAULT_INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  'it-services': {
    industry: 'IT services',
    opmMin: 22,
    opmMax: 28,
    peMedian: 20,
    minRoa: 20,
  },
  pharma: {
    industry: 'Pharma',
    opmMin: 25,
    opmMax: 35,
    peMedian: 25,
  },
  fmcg: {
    industry: 'FMCG',
    opmMin: 18,
    opmMax: 25,
    peMedian: 30,
    minRoa: 15,
  },
  paints: {
    industry: 'Paints',
    opmMin: 18,
    opmMax: 28,
    peMedian: 30,
  },
  automobiles: {
    industry: 'Automobiles',
    opmMin: 8,
    opmMax: 12,
    peMedian: 15,
  },
  retail: {
    industry: 'Retail',
    opmMin: 5,
    opmMax: 8,
  },
  'steel-metals': {
    industry: 'Steel & metals',
    opmMin: 8,
    opmMax: 15,
  },
  banks: {
    industry: 'Banks',
    peMedian: 15,
    minRoa: 0.8,
  },
  commodities: {
    industry: 'Commodities',
    peMedian: 8,
  },
  manufacturing: {
    industry: 'Manufacturing',
    minRoa: 8,
  },
  'capital-intensive': {
    industry: 'Capital intensive',
    minRoa: 5,
  },
};

/**
 * Normalizes input string to match known benchmark keys.
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Lookup industry benchmark by sector or industry name.
 * Returns null if no benchmark is defined for the industry.
 */
export function findIndustryBenchmark(industryOrSector?: string | null): IndustryBenchmark | null {
  if (!industryOrSector) {
    return null;
  }

  const normalized = normalizeKey(industryOrSector);

  // Exact key match
  if (DEFAULT_INDUSTRY_BENCHMARKS[normalized]) {
    return DEFAULT_INDUSTRY_BENCHMARKS[normalized]!;
  }

  // Alias / heuristic matching
  if (
    normalized.includes('itservice') ||
    normalized.includes('infotech') ||
    normalized.includes('informationtechnology') ||
    normalized === 'it' ||
    normalized.includes('software')
  ) {
    return DEFAULT_INDUSTRY_BENCHMARKS['it-services']!;
  }

  if (normalized.includes('pharma') || normalized.includes('healthcare') || normalized.includes('drug')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['pharma']!;
  }

  if (normalized.includes('fmcg') || normalized.includes('consumergoods') || normalized.includes('staples')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['fmcg']!;
  }

  if (normalized.includes('paint')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['paints']!;
  }

  if (normalized.includes('auto') || normalized.includes('vehicle')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['automobiles']!;
  }

  if (normalized.includes('retail')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['retail']!;
  }

  if (normalized.includes('steel') || normalized.includes('metal')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['steel-metals']!;
  }

  if (
    normalized.includes('bank') ||
    normalized.includes('nbfc') ||
    normalized.includes('lending') ||
    normalized.includes('financialservice')
  ) {
    return DEFAULT_INDUSTRY_BENCHMARKS['banks']!;
  }

  if (normalized.includes('commodity') || normalized.includes('commodities') || normalized.includes('mining')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['commodities']!;
  }

  if (normalized.includes('manufacturing') || normalized.includes('industrial')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['manufacturing']!;
  }

  if (normalized.includes('capitalintensive') || normalized.includes('infrastructure') || normalized.includes('power')) {
    return DEFAULT_INDUSTRY_BENCHMARKS['capital-intensive']!;
  }

  return null;
}
