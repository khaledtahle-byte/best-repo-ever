import { groupDigits } from '@/lib/money';
import type { DayStats } from '@/lib/store/orders';
import type { Locale } from '@/lib/types';

/** Rounds an axis maximum up to a clean 1/2/5 × 10ⁿ so ticks read as round numbers. */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function dayLabel(day: string, locale: Locale): string {
  const [, month, date] = day.split('-');
  return locale === 'ar' ? `${date}/${month}` : `${date}/${month}`;
}

/**
 * A single-series column chart in plain HTML — no chart library, no client
 * JavaScript. One series means one colour and no legend: the heading says what
 * is plotted. Values are labelled selectively (today and the best day); the
 * axis and the table underneath carry the rest.
 */
export function RevenueChart({
  data,
  locale,
  title,
}: {
  data: DayStats[];
  locale: Locale;
  title: string;
}) {
  const max = niceCeil(Math.max(...data.map((d) => d.revenueLbp), 0));
  const ticks = [max, max / 2, 0];
  const best = data.reduce((top, d) => (d.revenueLbp > top.revenueLbp ? d : top), data[0]);
  const today = data[data.length - 1];

  return (
    <figure className="card p-4">
      <figcaption className="mb-4 text-sm font-black uppercase tracking-wide text-brand-muted">
        {title}
      </figcaption>

      {/* Time always runs oldest → newest regardless of the page direction. */}
      <div dir="ltr" className="flex gap-3">
        <div className="flex w-14 shrink-0 flex-col justify-between py-[18px] text-end">
          {ticks.map((tick) => (
            <span key={tick} className="text-[10px] font-bold tabular-nums text-brand-muted">
              {compact(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44 pt-[18px]">
            {/* Hairline, solid, one step off the surface. */}
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-brand-line"
                style={{ top: `calc(18px + ${(1 - tick / max) * 100}% - ${(1 - tick / max) * 18}px)` }}
              />
            ))}

            <ol className="relative flex h-full items-end gap-1.5">
              {data.map((entry) => {
                const ratio = max ? entry.revenueLbp / max : 0;
                const labelled =
                  entry.day === today?.day || (best && entry.day === best.day && best.revenueLbp > 0);
                return (
                  <li
                    key={entry.day}
                    tabIndex={0}
                    className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                  >
                    {labelled && entry.revenueLbp > 0 ? (
                      <span
                        className="pointer-events-none absolute text-[10px] font-black tabular-nums text-brand-ink"
                        style={{ bottom: `calc(${ratio * 100}% + 4px)` }}
                      >
                        {compact(entry.revenueLbp)}
                      </span>
                    ) : null}

                    <span
                      className="w-full max-w-6 rounded-t bg-brand-red transition-opacity group-hover:opacity-80"
                      style={{ height: entry.revenueLbp > 0 ? `${Math.max(ratio * 100, 1.5)}%` : '2px' }}
                    />

                    {/* Hover and keyboard focus surface the exact figures. */}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-lg bg-brand-ink px-2 py-1 text-[10px] font-bold leading-tight text-white opacity-0 shadow-lift transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                    >
                      {dayLabel(entry.day, locale)} · {groupDigits(entry.revenueLbp)}
                      <span className="block opacity-70">
                        {entry.orders} {locale === 'ar' ? 'طلبات' : 'orders'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <ol className="mt-1.5 flex gap-1.5">
            {data.map((entry) => (
              <li
                key={entry.day}
                className="flex-1 text-center text-[9px] font-bold tabular-nums text-brand-muted"
              >
                {dayLabel(entry.day, locale)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
