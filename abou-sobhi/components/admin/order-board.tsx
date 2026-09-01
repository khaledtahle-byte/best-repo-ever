'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrderCard } from './order-card';
import { StatCard } from './stat-card';
import { statusLabel } from '@/components/storefront/status-timeline';
import {
  playNewOrderChime,
  requestDesktopNotifications,
  showDesktopNotification,
  unlockAudio,
} from '@/lib/notify';
import { translator } from '@/lib/i18n';
import { formatLbp } from '@/lib/money';
import type { DashboardStats, StoredOrder } from '@/lib/store/orders';
import { OPEN_STATUSES, type Locale, type OrderStatus } from '@/lib/types';

const POLL_MS = 8_000;

interface OrderBoardProps {
  initialOrders: StoredOrder[];
  initialStats: DashboardStats;
  locale: Locale;
  usdRate: number;
}

export function OrderBoard({ initialOrders, initialStats, locale, usdRate }: OrderBoardProps) {
  const t = translator(locale);
  const [orders, setOrders] = useState(initialOrders);
  const [stats, setStats] = useState(initialStats);
  const [now, setNow] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Orders already on screen when the shift started must not all chime at once.
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const soundRef = useRef(false);
  soundRef.current = soundOn;

  const announce = useCallback(
    (incoming: StoredOrder[]) => {
      const fresh = incoming.filter((order) => !knownIds.current.has(order.id));
      for (const order of incoming) knownIds.current.add(order.id);
      if (!fresh.length) return;

      if (soundRef.current) playNewOrderChime();
      const first = fresh[0];
      showDesktopNotification(
        fresh.length === 1
          ? `${t('newOrders')} · ${first.customerName}`
          : `${fresh.length} ${t('newOrders')}`,
        formatLbp(fresh.reduce((sum, order) => sum + order.totalLbp, 0), locale),
      );
    },
    [locale, t],
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        ok: boolean;
        orders: StoredOrder[];
        stats: DashboardStats;
        at: string;
      };
      if (!payload.ok) return;
      announce(payload.orders);
      setOrders(payload.orders);
      setStats(payload.stats);
      setUpdatedAt(payload.at);
      setNow(Date.now());
    } catch {
      // A dropped poll is not worth surfacing; the next tick retries.
    }
  }, [announce]);

  useEffect(() => {
    const id = window.setInterval(refresh, POLL_MS);
    // The clock has to keep moving even between polls or ages look frozen.
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [refresh]);

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      await unlockAudio();
      await requestDesktopNotifications();
      playNewOrderChime();
    }
  };

  const act = async (id: number, status: OrderStatus) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo(
    () =>
      OPEN_STATUSES.map((status) => ({
        status,
        orders: orders.filter((order) => order.status === status),
      })),
    [orders],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('todayRevenue')}
          value={formatLbp(stats.todayRevenueLbp, locale)}
          sub={usdRate ? `$${(stats.todayRevenueLbp / usdRate).toFixed(0)}` : undefined}
          tone="yellow"
        />
        <StatCard label={t('todayOrders')} value={String(stats.todayOrders)} />
        <StatCard label={t('avgOrder')} value={formatLbp(stats.averageOrderLbp, locale)} />
        <StatCard
          label={t('activeNow')}
          value={String(stats.activeOrders)}
          tone={stats.newOrders > 0 ? 'red' : 'plain'}
          sub={stats.newOrders ? `${stats.newOrders} ${t('newOrders')}` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t('liveOrders')}</h1>
        <div className="flex items-center gap-2">
          {updatedAt ? (
            <span className="text-xs font-semibold tabular-nums text-brand-muted">
              {t('refreshedAt')} {new Date(updatedAt).toLocaleTimeString('en-GB', { hour12: false })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            className={soundOn ? 'btn-ink btn-sm' : 'btn-ghost btn-sm'}
          >
            {soundOn ? '🔔' : '🔕'} {soundOn ? t('soundOn') : t('soundOff')}
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="card px-4 py-16 text-center text-sm font-semibold text-brand-muted">
          {t('noOrdersYet')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {columns.map((column) => (
            <section key={column.status} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-muted">
                {statusLabel(column.status, locale)}
                <span className="rounded-full bg-brand-cream px-2 py-0.5 text-[11px] tabular-nums">
                  {column.orders.length}
                </span>
              </h2>
              {column.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  locale={locale}
                  now={now}
                  busy={busyId === order.id}
                  onAction={act}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
