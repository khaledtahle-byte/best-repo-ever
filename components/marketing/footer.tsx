import Link from 'next/link';
import { Logo } from '@/components/logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Dashboard', href: '/app' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create an account', href: '/signup' },
      { label: 'Billing', href: '/app/settings' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'hello@dealguard.app', href: 'mailto:hello@dealguard.app' },
      { label: 'Support', href: 'mailto:support@dealguard.app' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="py-14">
      <div className="container">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Know what a supplier offer really costs before you sign it.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/75 transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DealGuard</p>
          <p>Built for the person who signs the orders.</p>
        </div>
      </div>
    </footer>
  );
}
