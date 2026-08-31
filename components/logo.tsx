import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The mark is a shield split by a price line — guard plus deal, no wordplay. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-6 w-6', className)} aria-hidden="true">
      <path
        d="M12 2.5 4.5 5.4v6.2c0 4.4 3.1 8.4 7.5 9.9 4.4-1.5 7.5-5.5 7.5-9.9V5.4L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 13.6l2.6-3.1 2.2 2.1L16.2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2', className)}>
      <LogoMark className="h-6 w-6 text-primary transition-transform group-hover:scale-105" />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">DealGuard</span>
    </Link>
  );
}
