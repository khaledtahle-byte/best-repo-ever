import type { Metadata } from 'next';
import { OrderBoard } from '@/components/admin/order-board';
import { getDb } from '@/lib/db';
import { dashboardStats, listActiveOrders } from '@/lib/store/orders';
import { getSettings } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live orders' };

export default function AdminBoardPage() {
  const db = getDb();
  return (
    <main className="p-4 sm:p-6">
      <OrderBoard
        initialOrders={listActiveOrders(db)}
        initialStats={dashboardStats(7, db)}
        locale={getLocale()}
        usdRate={getSettings(db).usdRate}
      />
    </main>
  );
}
