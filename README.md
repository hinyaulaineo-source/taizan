# TrackZAN Web App

Core MVP for role-based coaching operations:
- Owner dashboard (admin view + session approvals)
- Coach dashboard (session creation + athlete feedback)
- Athlete dashboard (session viewing + booking + feedback)
- Parent dashboard (linked athlete bookings + feedback)

## Tech Stack

- Next.js App Router
- Supabase Auth + Postgres
- TypeScript

## 1) Environment Variables

Create `.env.local` for local development. For Vercel, set the same keys per environment (Production + Preview).

### Required (baseline)

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use your deployed site URL for production (e.g. `https://your-app.vercel.app`). Add that URL and wildcard preview URLs under **Supabase → Authentication → URL Configuration** so redirects work.

### Server-only (Supabase admin + cron + billing)

```bash
# Admin CSV roster sync, Stripe webhook, cron routes
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vercel Cron: must match project env; Vercel sends Authorization: Bearer <CRON_SECRET>
CRON_SECRET=long_random_string

# Optional: nightly roster import from a published CSV URL (Google Sheets “publish to web” CSV, etc.)
ROSTER_CSV_URL=
# Optional: JSON object of extra fetch headers, e.g. {"Authorization":"Bearer token"}
ROSTER_CSV_FETCH_HEADERS=

# Optional: Stripe (see `/api/billing/checkout`, webhook `/api/webhooks/stripe`)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# Comma-separated Stripe Price IDs allowed from the client(e.g. price_xxx,price_yyy)
STRIPE_PRICE_ALLOWLIST=

# Optional: session reminder emails(`GET /api/cron/session-reminders`)
RESEND_API_KEY=
RESEND_FROM_EMAIL="TrackZAN <onboarding@resend.dev>"

# Roster CSV: minimum ref-no / password length (default 6)
CSV_MIN_PASSWORD_LENGTH=6
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `CRON_SECRET` to the browser.

## 2) Database Setup

1. Open Supabase SQL Editor.
2. For a **new** project, run `supabase/schema.sql`, then apply incremental files in `supabase/migrations/` in filename order (or use the CLI flow below).
3. Invite users from Supabase Auth.
4. Ensure each user has a `profiles` row with role set to one of: `owner`, `coach`, `athlete`, `parent`.

Example role update:

```sql
update profiles
set role = 'owner'
where email = 'your@email.com';
```

### Migrations on each release (recommended)

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link the project, then from the repo root:

```bash
supabase db push
```

Or copy new files from `supabase/migrations/` into the SQL Editor and run them in chronological order. CI checks that migration filenames sort in apply order when you change files under `supabase/migrations/`.

## 3) Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Quality checks(same as CI):

```bash
npm run lint
npm run typecheck
npm run build
```

## 4) Deploy(Vercel)

1. Import the GitHub repo and set **all** environment variables from §1 for Production(and Preview if you use previews).
2. **Stripe:** create a webhook endpoint pointing to `https://<your-domain>/api/webhooks/stripe`, select events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and paste the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. **Cron:** [`vercel.json`](vercel.json) registers daily roster sync (`05:00` UTC) and hourly session reminders. Cron jobs only run on [Vercel’s production deployment](https://vercel.com/docs/cron-jobs); set `CRON_SECRET` so requests are authenticated.

### Automation endpoints

| Path | Purpose |
|------|---------|
| `POST /api/admin/sync-google-sheet` | Owner UI: upload roster CSV (same as before). |
| `GET /api/cron/roster-sync` | Cron: fetch `ROSTER_CSV_URL`, sync athletes(`Bearer CRON_SECRET`). |
| `GET /api/cron/session-reminders` | Cron: email ~24h reminders(`Bearer CRON_SECRET`; requires Resend env). |
| `POST /api/billing/checkout` | JSON `{ "tier", "priceId" }` — returns Stripe Checkout `url`. |
| `POST /api/webhooks/stripe` | Stripe → upsert `public.subscriptions`. |

## 5) Current Implemented Flows

- Login via Supabase password auth at `/login`
- Role-aware routing from `/dashboard`
- Coach submits session(`pending` by default)
- Owner approves/rejects pending sessions
- Athlete books published sessions(tier/status gated)
- Coach records athlete feedback
- Parent sees linked athlete bookings and feedback
- Optional: scheduled roster CSV sync, subscription checkout + webhook, session reminder emails

## 6) Next Recommended Steps

- Tighten server-side auditing and rate limits on admin-heavy routes
- Map each `subscription_tier` to a Stripe Price in product config(or UI) and keep `STRIPE_PRICE_ALLOWLIST` in sync
