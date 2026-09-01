'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `side` docks to the inline edge on desktop; both slide up on mobile. */
  side?: boolean;
}

/**
 * A bottom sheet on phones (where every order is actually placed) that becomes
 * a side panel on wider screens. Deliberately hand-rolled: one dialog pattern
 * is not worth a dependency, and this one has to behave in RTL.
 */
export function Sheet({ open, onClose, title, children, footer, side }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-brand-ink/45 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-brand-paper shadow-lift outline-none',
          'animate-slide-up rounded-t-3xl sm:rounded-3xl',
          side ? 'sm:max-w-md' : 'sm:max-w-lg',
        ].join(' ')}
      >
        <header className="flex items-center justify-between gap-3 border-b border-brand-line bg-white px-5 py-4">
          <h2 className="text-lg font-extrabold tracking-tight text-brand-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand-cream text-brand-char transition hover:bg-brand-line"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer ? (
          <footer className="safe-bottom border-t border-brand-line bg-white px-5 pt-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
