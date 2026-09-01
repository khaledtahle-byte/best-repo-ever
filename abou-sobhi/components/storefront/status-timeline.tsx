import { translator } from '@/lib/i18n';
import type { Fulfilment, Locale, OrderStatus } from '@/lib/types';

const LABEL_KEYS = {
  new: 'statusNew',
  preparing: 'statusPreparing',
  ready: 'statusReady',
  delivering: 'statusDelivering',
  done: 'statusDone',
  cancelled: 'statusCancelled',
} as const;

export function statusLabel(status: OrderStatus, locale: Locale): string {
  return translator(locale)(LABEL_KEYS[status]);
}

export const STATUS_COLOURS: Record<OrderStatus, string> = {
  new: 'bg-state-new',
  preparing: 'bg-state-preparing',
  ready: 'bg-state-ready',
  delivering: 'bg-state-delivering',
  done: 'bg-state-done',
  cancelled: 'bg-state-cancelled',
};

export function StatusTimeline({
  status,
  fulfilment,
  locale,
}: {
  status: OrderStatus;
  fulfilment: Fulfilment;
  locale: Locale;
}) {
  const t = translator(locale);
  const steps: OrderStatus[] =
    fulfilment === 'delivery'
      ? ['new', 'preparing', 'ready', 'delivering', 'done']
      : ['new', 'preparing', 'ready', 'done'];

  if (status === 'cancelled') {
    return (
      <div className="rounded-xl bg-brand-red-soft px-4 py-3 text-sm font-extrabold text-brand-red-dark">
        {t('statusCancelled')}
      </div>
    );
  }

  const currentIndex = steps.indexOf(status);

  return (
    <ol className="flex items-start gap-1">
      {steps.map((step, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step} className="flex-1">
            <div className="flex items-center">
              <span
                className={[
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black transition',
                  reached ? `${STATUS_COLOURS[step]} text-white` : 'bg-brand-line text-brand-muted',
                  isCurrent ? 'animate-pulse-ring' : '',
                ].join(' ')}
              >
                {reached ? '✓' : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`h-1 flex-1 rounded-full ${
                    index < currentIndex ? STATUS_COLOURS[step] : 'bg-brand-line'
                  }`}
                />
              ) : null}
            </div>
            <p
              className={`mt-1.5 pe-1 text-[10px] font-bold leading-tight sm:text-xs ${
                reached ? 'text-brand-ink' : 'text-brand-muted'
              }`}
            >
              {t(LABEL_KEYS[step])}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
