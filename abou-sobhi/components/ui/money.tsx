import { formatLbp, lbpToUsd, formatUsd } from '@/lib/money';
import type { Locale } from '@/lib/types';

interface MoneyProps {
  value: number;
  locale: Locale;
  /** LBP per USD. 0 or undefined hides the dollar line. */
  rate?: number;
  className?: string;
  usdClassName?: string;
  /** Renders the dollar figure beside the lira instead of underneath it. */
  inline?: boolean;
}

/**
 * Lebanese shops quote both currencies: the lira is the price of record, the
 * dollar is the number most customers do the arithmetic in.
 */
export function Money({ value, locale, rate, className, usdClassName, inline }: MoneyProps) {
  const usd = rate ? lbpToUsd(value, rate) : null;
  const lbp = formatLbp(value, locale);

  if (usd === null) return <span className={className}>{lbp}</span>;

  if (inline) {
    return (
      <span className={className}>
        {lbp}
        <span className={usdClassName ?? 'ms-1.5 text-[.85em] font-semibold opacity-70'}>
          ({formatUsd(usd)})
        </span>
      </span>
    );
  }

  return (
    <span className={`flex flex-col items-end leading-tight ${className ?? ''}`}>
      <span>{lbp}</span>
      <span className={usdClassName ?? 'text-[.72em] font-semibold opacity-65'}>
        {formatUsd(usd)}
      </span>
    </span>
  );
}
