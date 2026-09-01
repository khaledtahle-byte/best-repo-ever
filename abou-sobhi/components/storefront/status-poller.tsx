'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the customer's tracking page current without a websocket. A shawarma
 * order lives for twenty minutes, so a light poll is the right amount of
 * machinery — and it stops once the order reaches a terminal status.
 */
export function StatusPoller({ active, intervalMs = 20_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
