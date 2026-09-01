'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, Menu, Settings, Truck, Upload, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Entitlements } from '@/lib/plans';

const NAV = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/analyze', label: 'Analyse offer', icon: Upload, exact: false },
  { href: '/app/suppliers', label: 'Suppliers', icon: Truck, exact: false },
  { href: '/app/settings', label: 'Settings', icon: Settings, exact: false },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UsagePanel({ entitlements }: { entitlements: Entitlements }) {
  const { analysesLimit, analysesUsed, analysesRemaining, planName } = entitlements;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</span>
        <Badge variant={entitlements.plan === 'free' ? 'outline' : 'default'}>{planName}</Badge>
      </div>

      {analysesLimit === null ? (
        <p className="mt-3 text-sm text-muted-foreground">Unlimited analyses.</p>
      ) : (
        <>
          <p className="tabular mt-3 text-sm">
            <span className="font-medium text-foreground">{analysesUsed}</span>
            <span className="text-muted-foreground"> of {analysesLimit} analyses used</span>
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={analysesUsed}
            aria-valuemin={0}
            aria-valuemax={analysesLimit}
            aria-label="Monthly analyses used"
          >
            <div
              className={cn('h-full rounded-full', analysesRemaining === 0 ? 'bg-bad' : 'bg-primary')}
              style={{ width: `${Math.min(100, (analysesUsed / analysesLimit) * 100)}%` }}
            />
          </div>
          <Button asChild size="sm" className="mt-3 w-full">
            <Link href="/app/settings">Upgrade to Pro</Link>
          </Button>
        </>
      )}
    </div>
  );
}

export function Sidebar({ entitlements }: { entitlements: Entitlements }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Logo href="/app" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <Logo href="/app" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-auto">
              <UsagePanel entitlements={entitlements} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-card/40 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-2 py-2">
          <Logo href="/app" />
        </div>
        <NavLinks />
        <div className="mt-auto space-y-3">
          <UsagePanel entitlements={entitlements} />
          <Link
            href="/app/analyze"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Every analysis feeds your history
          </Link>
        </div>
      </aside>
    </>
  );
}
