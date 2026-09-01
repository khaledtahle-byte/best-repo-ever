import { Layers, ScanSearch, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const BENEFITS = [
  {
    icon: ScanSearch,
    title: 'See the real number',
    body:
      'Volume rebates you will not qualify for. Freight that is not in the unit price. A 12% discount off a list price that quietly rose 8%. DealGuard reduces every offer to one honest figure: what a unit actually costs you, delivered and settled.',
    proof: 'Nine cost components, priced per line.',
  },
  {
    icon: Layers,
    title: 'Compare against your own history',
    body:
      'Market benchmarks are guesses. Your invoices are facts. Every analysis is checked against what you paid the last time — same product, same supplier — and against what your other suppliers charge for it right now.',
    proof: '“Worse than your last offer”, with the amount.',
  },
  {
    icon: Send,
    title: 'Send the counter-offer',
    body:
      'The hard part is not spotting the problem, it is writing the email. DealGuard drafts it with named lines, target prices and the reason behind each ask — ready to send, or to edit in thirty seconds.',
    proof: 'Specific asks, each with a value attached.',
  },
];

export function Benefits() {
  return (
    <section className="border-b border-border py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Three things a buying team never has time to do
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            DealGuard does them in the time it takes to open the attachment.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body, proof }) => (
            <Card key={title} className="flex flex-col transition-colors hover:border-primary/40">
              <CardContent className="flex flex-1 flex-col p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                <p className="mt-5 border-t border-border pt-4 text-sm font-medium text-primary">{proof}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
