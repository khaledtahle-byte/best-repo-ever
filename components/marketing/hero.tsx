import Link from 'next/link';
import { ArrowRight, FileSpreadsheet, FileText, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SampleBreakdown } from '@/components/marketing/sample-breakdown';

const INPUTS = [
  { icon: FileText, label: 'PDF quote' },
  { icon: FileSpreadsheet, label: 'CSV or XLSX price list' },
  { icon: ClipboardPaste, label: 'Pasted email' },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-[0.35]" />

      <div className="container relative py-20 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.12fr_1fr] lg:gap-16">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              For independent retailers and restaurants
            </p>

            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Retailers overpay <span className="whitespace-nowrap text-primary">4–11%</span> on
              supplier deals.
              <span className="mt-1 block text-foreground/55">Usually without knowing it.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              The discount on the front page is not the price you pay. DealGuard reads a supplier
              offer, works out the true net cost per unit after rebates, freight, surcharges and
              payment terms, checks it against what you paid last time, and writes the counter-offer
              email for you.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  Analyse an offer free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Three analyses a month on the free plan. No card required.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6">
              {INPUTS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up lg:pl-4" style={{ animationDelay: '120ms' }}>
            <SampleBreakdown />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              A real analysis, computed live by the same engine the product runs on your uploads.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
