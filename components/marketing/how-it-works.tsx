const STEPS = [
  {
    number: '01',
    title: 'Drop in the offer',
    body:
      'A PDF quotation, a CSV or XLSX price list, or the body of the email pasted straight in. DealGuard pulls out line items, quantity breaks, discounts, surcharges, rebate terms and payment terms. If a document defeats it — a scan, a photo — it says so and hands you a manual entry form instead of guessing.',
  },
  {
    number: '02',
    title: 'Get the true cost per unit',
    body:
      'Freight is allocated across lines. Surcharges are priced. The rebate is discounted for how long it takes to arrive and dropped entirely if the order does not reach the threshold. Payment terms are valued at your cost of capital. What comes out is the cost per kilo, per litre, per unit — comparable across suppliers for the first time.',
  },
  {
    number: '03',
    title: 'Send the counter-offer',
    body:
      'Every problem becomes a specific ask with a number attached: hold this line at your last price, drop the pallet fee, apply the rebate at the volume we actually order. Copy the email, send it, and the next offer from that supplier gets measured against this one.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Attachment to counter-offer in about two minutes
          </h2>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.number} className="bg-card p-7">
              <span className="tabular text-sm font-semibold text-primary">{step.number}</span>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
