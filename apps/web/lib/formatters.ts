/**
 * Financial Workstation Display Formatters
 * Formats Indian equities currency (INR), financial ratios, percentages, and IST timestamps.
 */

export function formatINR(value: number | null | undefined, options?: { showSymbol?: boolean }): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  const symbol = options?.showSymbol !== false ? '₹' : '';
  return `${symbol}${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

export function formatCrores(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  // If value is already in Crores:
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} Cr`;
}

export function formatRupeesToCrores(valueInRupees: number | null | undefined, decimals = 2): string {
  if (valueInRupees === null || valueInRupees === undefined || isNaN(valueInRupees)) {
    return '—';
  }
  const inCrores = valueInRupees / 10000000;
  return formatCrores(inCrores, decimals);
}

export function formatPercent(
  value: number | null | undefined,
  options?: { showSign?: boolean; decimals?: number }
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  const decimals = options?.decimals ?? 2;
  const formatted = Math.abs(value).toFixed(decimals);
  if (options?.showSign && value > 0) {
    return `+${formatted}%`;
  }
  if (value < 0) {
    return `-${formatted}%`;
  }
  return `${formatted}%`;
}

export function formatRatio(value: number | null | undefined, suffix = 'x', decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(decimals)}${suffix}`;
}

export function formatDateIST(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '—';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatDateTimeIST(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '—';
  const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return '—';

  const datePart = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);

  return `${datePart}, ${timePart} IST`;
}
