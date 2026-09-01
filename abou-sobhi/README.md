# أبو صبحي — Abou Sobhi

**Online ordering and a kitchen admin panel for a Lebanese shawarma shop.**

A customer browses the menu in Arabic or English, drops a pin on a map, and
orders. The shop sees it land on a live board within seconds, hears a chime,
prints a thermal receipt, and taps the order through preparing → ready → out for
delivery → delivered. The customer follows the same steps on a tracking page.

Built around how food is actually ordered in Lebanon: prices in the millions of
lira with a fresh-dollar figure beside them, no street addresses so the map pin
*is* the address, WhatsApp as the confirmation channel, and a whole-menu reprice
button for the days the rate moves.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict) |
| Styling | Tailwind CSS, hand-rolled components (no UI dependency) |
| Database | SQLite via `better-sqlite3` — one file, no server to run |
| Maps | Leaflet + OpenStreetMap — no API key, no billing account |
| Auth | One staff password, HMAC-signed session cookie, throttled login |
| Tests | Vitest |

The whole thing is one Node process and one file on disk. That is deliberate:
a single shop does not need a managed Postgres, and the owner should be able to
back the business up by copying `data/abou-sobhi.db` onto a USB stick.

---

## Quick start

```bash
npm install
npm run db:demo     # optional: a week of realistic orders to look at
npm run dev         # http://localhost:3000
```

The database creates and seeds itself on first boot from the printed menu — all
20 items, 25 prices, the three add-ons and nine Tripoli delivery zones.

- Storefront — <http://localhost:3000>
- Order tracking — <http://localhost:3000/track>
- Admin panel — <http://localhost:3000/admin> (development password: `abousobhi`)

```bash
npm run build && npm run start   # production
npm test                         # 58 tests
npm run typecheck && npm run lint
npm run db:reset                 # wipe and rebuild from the menu — destructive
```

---

## What the customer gets

- **The full printed menu**, grouped into chicken / meat / mix / chilli baguette
  / Turkish / pizza, with sandwich and platter prices exactly as printed.
- **Arabic first, English second**, with real RTL — the layout mirrors, not just
  the text. The switch is a plain link, so it works before hydration.
- **Every price in both currencies.** Lira is the price of record; the dollar
  figure is derived from a rate the owner sets and can switch off entirely.
- **Extras, quantities and per-item notes** — "شاورما دجاج، جبنة زيادة، بدون بصل".
- **A map pin instead of an address.** One tap for GPS, or drag the pin. Street,
  building, floor and landmark are supporting detail for the driver, and the
  order carries a Google Maps *and* a Waze link.
- **Delivery or pickup**, with a per-zone fee and a free-delivery threshold.
- **A short order code** (`K7M-2QX`) that tracks the order live and reads
  cleanly over a bad phone line — no I, L, O or U to be misheard.
- **A WhatsApp button** that sends the whole order as text, address and map link
  included.

## What the shop gets

- **A live order board** that polls every 8 seconds, columns by status, with a
  synthesised chime and a desktop notification when an order lands. Cards go
  yellow at 10 minutes and red at 20, so a late order is visible across a room.
- **One tap per status change**, with the transitions enforced server-side so two
  phones cannot walk the same order backwards.
- **80mm thermal receipts** — a real print stylesheet, not a screenshot.
- **Call and WhatsApp the customer**, and open the pin in Maps or Waze, from the
  order card.
- **Menu management**: edit any price, mark an item sold out, and — the one bulk
  edit a Lebanese shop genuinely needs — **reprice the entire board by a
  percentage**, rounded to the nearest 50,000 L.L.
- **Store settings**: name, phone, WhatsApp, location, dollar rate, prep and
  delivery times, minimum order, free-delivery threshold, per-day opening hours
  (including closing after midnight), delivery zones and their fees, and a kill
  switch for when the spit runs out.
- **Reports**: revenue and order counts by day, average order value, best
  sellers, over 7 or 30 days.

---

## Decisions worth knowing about

**The client never sets a price.** The browser posts slugs and quantities;
`lib/pricing.ts` re-prices the whole cart from the database, applies the zone
fee and the minimum, and is the only place an order total is computed. A
tampered payload changes nothing.

**Orders snapshot what they were sold as.** Item names, the zone name and the
delivery fee are copied onto the order. Repricing the menu tomorrow does not
rewrite yesterday's receipts.

**Money is whole lira, end to end.** Integers, never floats, never a minor unit —
the smallest note anybody in the shop handles is 1,000 L.L. The dollar figure is
display-only and derived at render time.

**The business day ends at 4am, not midnight.** The shop closes at 2am, so the
sandwiches sold at 01:30 belong to the night that started the evening before.
`lib/time.ts` anchors every date to Asia/Beirut and applies that cutoff, so
"today's takings" is right for the shop rather than right for the server.

**The tracking code is the credential.** It is drawn from a CSPRNG over a
32-character alphabet rather than being a sequential number, because anyone who
could guess it would read a stranger's phone number and home location.

**OpenStreetMap, not Google Maps.** No API key to obtain, no card on file, no
per-load quota — a single shop should not need a cloud billing account to show
a map. Navigation still hands off to Google Maps or Waze, which is where the
driver wants to end up anyway.

---

## Deploying

Any host that runs a Node process and gives you a writable disk: a small VPS, a
Raspberry Pi in the shop, Fly.io, Railway, Render.

```bash
npm ci && npm run build && npm run start
```

Set `ADMIN_PASSWORD` and `SESSION_SECRET` (see `.env.example`) — the admin panel
shows a warning banner until you do. Point `DATABASE_PATH` at a persistent
volume and back that file up; it is the entire business.

Serverless platforms that give each request a fresh filesystem (Vercel's
functions, for example) will not persist the SQLite file. On those, swap the
`lib/store/*` modules for a hosted Postgres — every query is already isolated
behind that layer for exactly this reason.

---

## Layout

```
app/
  page.tsx                   storefront
  track/, order/[code]/      customer order tracking
  admin/login/               staff login
  admin/(panel)/             board · orders · menu · reports · settings
  api/orders/                the one write path a customer can reach
  api/admin/orders/          board polling and status changes
components/storefront/       menu, cart, checkout, map picker
components/admin/            board, order cards, receipt, revenue chart
lib/
  db/                        schema, connection, the printed menu as seed data
  store/                     every SQL query in the app
  pricing.ts                 authoritative cart pricing
  time.ts                    Asia/Beirut, opening hours, business day
  money.ts  phone.ts         lira formatting, Lebanese phone numbers
test/                        58 tests over pricing, orders, money, phone, time, auth
```
