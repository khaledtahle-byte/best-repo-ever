const CURRENCY_FALLBACK = 'USD';

export function formatCurrency(
  value: number | null | undefined,
  currency = CURRENCY_FALLBACK,
  opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.minimumFractionDigits ?? 2,
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  }).format(value);
}

/** Compact money for KPI tiles: $12.4k, $1.2M. */
export function formatCompactCurrency(value: number, currency = CURRENCY_FALLBACK): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1000) return formatCurrency(value, currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUnitPrice(value: number | null | undefined, currency = CURRENCY_FALLBACK): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const dp = Math.abs(value) < 10 ? 4 : 3;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: dp,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(dp)}%`;
}

export function formatSignedPercent(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(dp)}%`;
}

export function formatNumber(value: number | null | undefined, dp = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: dp }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/** "2/10 net 30" style rendering of payment terms. */
export function formatTerms(discountPct: number, discountDays: number, netDays: number): string {
  if (discountPct > 0 && discountDays > 0) {
    return `${trimNum(discountPct)}/${discountDays} net ${netDays}`;
  }
  return netDays > 0 ? `Net ${netDays}` : 'On delivery';
}

function trimNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
