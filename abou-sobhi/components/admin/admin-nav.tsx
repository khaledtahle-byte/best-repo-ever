'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type IconName = 'board' | 'orders' | 'menu' | 'reports' | 'settings';

export interface NavItem {
  href: string;
  label: string;
  /**
   * A name, not an element. JSX exported from a `'use client'` module cannot be
   * passed back across the server/client boundary as a prop — React's client
   * manifest only tracks components — so the server picks the icon by name and
   * this module draws it.
   */
  icon: IconName;
  badge?: number;
}

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true,
  } as const;

  switch (name) {
    case 'board':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M5 4h14v16l-3-2-2 2-2-2-2 2-3-2z" strokeLinejoin="round" />
          <path d="M9 9h6M9 13h4" strokeLinecap="round" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:gap-1.5 lg:overflow-visible">
      {items.map((item) => {
        // `/admin` must not light up for `/admin/menu`, so the root is exact.
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition',
              active
                ? 'bg-brand-yellow text-brand-ink'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <span className="shrink-0">
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
            {item.badge ? (
              <span className="ms-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1.5 text-[11px] font-black text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
