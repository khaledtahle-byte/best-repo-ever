# DealGuard

**Know what a supplier offer really costs before you sign it.**

DealGuard reads a supplier offer — a PDF quotation, a CSV or XLSX price list, or
an email pasted straight in — and works out the **true net cost per unit** after
volume tiers, off-invoice discounts, allocated freight, surcharges, early-payment
discounts, the time value of payment terms and the present value of back-end
rebates. It compares that against the buyer's own history, flags what is wrong
with a number attached, and drafts the counter-offer email.

Built for independent retailers, restaurants and small multi-site groups — the
businesses that sign supplier deals without a procurement department behind them.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Charts | Recharts |
| Database & auth | Supabase (Postgres + Auth), row-level security on every table |
| Payments | Stripe Checkout + Billing Portal + webhooks |
| Parsing | `unpdf` (PDF text layer), `papaparse` (CSV), `exceljs` (XLSX) |
| Tests | Vitest |
| Deployment | Vercel |

---

## Quick start

```bash
git clone <your-fork> dealguard
cd dealguard
npm install
cp .env.example .env.local     # then fill it in — see below
npm run dev                    # http://localhost:3000
```

Running without `.env.local` still boots: the marketing page renders in full, and
`/app` shows a setup checklist rather than a stack trace.

---

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. It is idempotent —
   safe to re-run after a schema change.
3. **Project Settings → API** gives you the three Supabase values below.
4. **Authentication → Providers → Email**: leave *Confirm email* on for
   production. For local development turn it off so sign-up returns a session
   immediately (the app handles both — with confirmation on it shows a
   "check your email" screen).
5. **Authentication → URL Configuration**: set the Site URL to your deployed
   origin and add `http://localhost:3000/auth/callback` plus
   `https://your-domain.com/auth/callback` as redirect URLs.

What the schema creates:

| Table | Purpose |
| --- | --- |
| `profiles` | One row per auth user. Plan, Stripe ids, cost of capital, target margin. Created automatically by a trigger on sign-up. |
| `organizations` / `organization_members` | Business-plan seats. A trigger enforces the seat limit in the database, not just the UI. |
| `suppliers` | One row per supplier per buyer, matched on a normalised name. |
| `offers` | One analysis: totals, verdict, score, savings, and the complete analysis JSON. |
| `offer_items` | Per-line inputs and results, indexed by `product_key` for benchmarking. |
| `offer_flags` | Every finding, with its severity and money impact. |
| `counter_offers` | Generated emails. |
| `usage_events` | Metering for the Free plan's 3 analyses a month. Service-role writes only. |
| `api_keys` | SHA-256 hashes of Business-plan API keys. The secret is shown once. |
| `price_history` (view) | `security_invoker` view over offers and items — powers the charts and the benchmarks. |

**Row-level security** is enabled on every table. A row is visible to its owner
(`owner_id = auth.uid()`) and to members of the organisation it belongs to.
Membership is resolved through a `security definer` helper (`is_org_member`) so
policies cannot recurse. `usage_events` has no insert policy at all — only the
service role can write metering, so a client cannot skip its own quota.

---

## 2. Stripe

1. **Products → Add product** twice:
   - *DealGuard Pro* — recurring, **$49 / month**
   - *DealGuard Business* — recurring, **$149 / month**
2. Copy each **price ID** (starts with `price_`, not `prod_`) into
   `STRIPE_PRICE_PRO` and `STRIPE_PRICE_BUSINESS`.
3. **Developers → API keys** → `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_failed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Testing webhooks locally:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# paste the whsec_... it prints into .env.local, then:
stripe trigger checkout.session.completed
```

The webhook verifies the signature against the raw request body, then writes the
plan onto `profiles`. For Business it also creates an `organizations` row, adds
the buyer as its owner, and sets the seat count — so the plan and its seats are
resolved server-side, never from the client.

---

## 3. Environment variables

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Same page. **Server-side only** — it bypasses RLS |
| `STRIPE_SECRET_KEY` | for billing | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | for billing | Stripe → Developers → Webhooks → signing secret |
| `STRIPE_PRICE_PRO` | for billing | Price ID of the $49/mo price |
| `STRIPE_PRICE_BUSINESS` | for billing | Price ID of the $149/mo price |
| `STRIPE_API_VERSION` | no | Pin the Stripe API version; defaults to the account's |
| `NEXT_PUBLIC_SITE_URL` | no | Absolute origin for Stripe redirects and confirmation emails. Inferred on Vercel |

---

## 4. Deploy to Vercel

1. Push the repository to GitHub and import it at
   [vercel.com/new](https://vercel.com/new). The defaults are correct — no build
   command overrides needed.
2. Add every variable from the table above under **Settings → Environment
   Variables** (Production *and* Preview).
3. Deploy, then point the Stripe webhook endpoint at
   `https://your-domain.com/api/stripe/webhook` and add
   `https://your-domain.com/auth/callback` to the Supabase redirect URLs.

---

## How the analysis works

The engine ([`lib/analysis/engine.ts`](lib/analysis/engine.ts)) is pure — no
network, no database — which is why it can be tested exhaustively and run on the
marketing page to produce the hero figures.

For each line:

```
gross              = quantity × quoted unit price
− volume tier discount        (only tiers the ordered quantity actually reaches)
− off-invoice discount        (applied sequentially, not added to the tier)
= invoice subtotal
+ allocated freight           (by line value or by quantity; waived above the
                               free-freight threshold)
+ allocated surcharges        (flat, per unit, or % of goods)
= invoice total
− early-payment discount      (taken only when it beats holding the cash)
− value of the payment terms  (cash held × cost of capital × days)
− rebate at present value     (zero if the order misses the threshold;
                               discounted for the delay before it is paid)
= true net line cost

true net unit cost = true net line cost ÷ (quantity × pack size)
```

Pack-size normalisation is what makes two offers comparable at all: a case of
`12 × 690g` and a `2.5kg` block are reduced to a cost per inner unit or per kilo.

**Benchmarking.** Each line is matched to history by SKU, then by a normalised
product key, then by token overlap of the description (Jaccard ≥ 0.7). The
preferred benchmark is the last price *this same supplier* quoted; failing that,
the median across the buyer's other suppliers.

**Flags** carry a severity and, wherever it is quantifiable, the money at stake:
worse than your last offer, above market, hidden cost, discount theatre, an
unqualified rebate, a volume break within reach, payment terms quietly shortened,
a list price rise under a bigger discount, thin or negative margin.

**Verdict.** Line scores are value-weighted into an offer score: ≥ 70 Good,
45–69 Review, < 45 Bad. Costs are deliberately charged once — freight and
surcharges are priced into each line, so the order-level hidden-cost flag is
reported but not scored again.

**The counter-offer email** is generated from the flags, so every ask names a
line, a target price and the reason behind it — never "can you sharpen this".

---

## Parsing, and what happens when it fails

| Input | How it is read |
| --- | --- |
| PDF | Text layer via `unpdf` (pdf.js), then the line heuristic below |
| CSV / TSV | `papaparse`, then header mapping with ~90 column synonyms |
| XLSX / XLSM | `exceljs`; picks whichever sheet contains a real product table |
| Pasted text | Tab/comma regions go through the table reader; prose through the line heuristic |

The table reader recognises volume-break columns (`50+`, `250+`), cross-checks
each row against its stated line total, and downgrades the row's confidence when
they disagree. The free-text reader classifies each token, keeps `12 x 690g`
together as a pack size rather than reading `12` as the quantity, and skips lines
that state terms rather than products. Payment terms, delivery charges,
surcharges and rebate wording are mined from the whole document.

**Failure is a first-class path.** A scanned PDF has no text to read; some
layouts defeat the heuristic. In those cases the app says so plainly and drops
you into the same editable form used to review a successful parse — so manual
entry is the normal flow with the fields pre-filled, not a separate feature.
Low-confidence lines are highlighted for checking. Parsing never spends a quota
unit; only running the analysis does.

---

## Pricing and entitlements

| | Free | Pro — $49/mo | Business — $149/mo |
| --- | --- | --- | --- |
| Analyses | 3 / month | Unlimited | Unlimited |
| Cost breakdown, hidden-cost detection | ✓ | ✓ | ✓ |
| Price history & benchmarking | — | ✓ | ✓ |
| Counter-offer email generator | — | ✓ | ✓ |
| Seats | 1 | 1 | 5 |
| API access | — | — | ✓ |

Entitlements are resolved server-side in [`lib/auth.ts`](lib/auth.ts) and enforced
in the API routes, not only in the UI.

---

## API (Business plan)

Create a key in **Settings → API keys**. It is shown once; only a SHA-256 hash is
stored.

```bash
curl -X POST https://your-domain.com/api/v1/analyze \
  -H "Authorization: Bearer dg_..." \
  -H "Content-Type: application/json" \
  -d '{"text": "Mozzarella 2.5kg block  120  18.40  6%\nPayment terms: 2/10 net 30"}'
```

Send either `text` (parsed server-side) or a structured `offer` object matching
`offerInputSchema` in [`lib/validation.ts`](lib/validation.ts). Pass
`"save": false` to analyse without writing to history. The response is
`{ offerId, analysis }` where `analysis` is the full `OfferAnalysis`.

---

## Project structure

```
app/
  page.tsx                    Marketing landing page
  (auth)/login|signup         Auth screens
  auth/callback|signout       Session exchange and sign-out
  app/                        Protected product (dashboard, analyze,
                              suppliers, settings, offers/[id])
  api/
    parse                     Read an offer; no quota, no writes
    analyze                   Benchmark, score, persist, meter
    counter-offer             Draft the negotiation email
    settings, keys            Profile settings and API keys
    stripe/                   checkout, portal, webhook
    v1/analyze                Business-plan public API
components/
  ui/                         shadcn/ui primitives
  marketing/ app/ analyze/ settings/
lib/
  analysis/                   engine, product matching, counter-offer writer
  parsing/                    pdf, csv, xlsx, text, terms, numbers, pack sizes
  supabase/                   browser, server, admin and middleware clients
  auth, queries, persist, plans, validation, format, utils
supabase/schema.sql           Tables, RLS policies, triggers, views
test/                         Vitest suites
```

---

## Testing

```bash
npm test          # 53 tests
npm run typecheck # tsc --noEmit
npm run lint
npm run build
```

The suite covers the arithmetic (discount sequencing, freight allocation and
conservation, implied APR, rebate qualification and present value, pack-size
normalisation, margin), every parser against generated PDF and XLSX fixtures,
and the whole pipeline from upload through analysis to a drafted email.

---

## Notes and limitations

- **Scanned PDFs are not read.** There is no OCR; the manual entry form is the
  path for them, and the app says so rather than guessing.
- **Benchmarks are your own data.** DealGuard ships no market price index —
  "below market" means below the median *you* pay across your suppliers. It is
  honest about which comparison it used on every line.
- **The `4–11%` figure** on the landing page is the range independent buyers
  typically recover when quoted prices are reconciled against delivered, settled
  cost. The product never asserts it about a specific business — it computes
  yours from your own offers.
- **Original files are not stored.** Extracted text is kept (capped at 100k
  characters) so a result can be re-checked; the upload itself is discarded.
- `npm audit` reports two advisories against the `postcss` version pinned inside
  Next.js 14's own dependency tree. They affect build-time CSS processing of
  untrusted stylesheets and are only resolvable by moving to Next.js 16, which
  the requested stack rules out.
