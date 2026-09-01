import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQS = [
  {
    q: 'Where does the 4–11% figure come from?',
    a: 'It is the range independent buyers typically recover when someone finally reconciles quoted prices against delivered, settled cost — unclaimed rebates, freight outside the unit price, volume breaks that were never applied, and list prices that crept up under a bigger headline discount. DealGuard does not assert the number for your business; it computes yours from your own offers, line by line.',
  },
  {
    q: 'What can it read?',
    a: 'PDF quotations with a text layer, CSV and XLSX price lists, and offers pasted straight from an email. It maps column headers automatically, handles volume-break columns like "100+", and pulls payment terms, delivery charges, surcharges and rebate wording out of the small print. Scanned PDFs have no text to read — in that case it tells you plainly and gives you a manual entry form.',
  },
  {
    q: 'What exactly is "true net cost"?',
    a: 'The quoted price, less volume-tier and off-invoice discounts, plus the freight and surcharges allocated to that line, less the early-payment discount when taking it beats holding the cash, less the rebate discounted for how long it takes to arrive — and zero if the order does not reach the rebate threshold. Divided by the real number of units in the pack. It is the figure you can honestly compare between two suppliers.',
  },
  {
    q: 'Do you need my accounting system or supplier logins?',
    a: 'No. DealGuard only ever sees the offers you give it. There is no integration to set up, no credentials to hand over, and nothing is shared with your suppliers. Your price history is built from the offers you analyse.',
  },
  {
    q: 'Who can see my prices?',
    a: 'Only you. Every table is protected by row-level security in Postgres, so a query can only ever return rows belonging to your account — or to your organisation, if you are on Business and have invited colleagues to your seats.',
  },
  {
    q: 'Can I cancel or change plan?',
    a: 'Yes, from billing settings, through the Stripe customer portal. Downgrading keeps your history; you simply lose access to the history views and the email generator until you upgrade again. Nothing is deleted.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-border py-20 lg:py-24">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Questions buyers actually ask
            </h2>
            <p className="mt-4 text-muted-foreground">
              Anything else, email{' '}
              <a href="mailto:hello@dealguard.app" className="text-primary hover:underline">
                hello@dealguard.app
              </a>
              .
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, index) => (
              <AccordionItem key={faq.q} value={`item-${index}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
