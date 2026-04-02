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

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 2) Database Setup

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Invite users from Supabase Auth.
4. Ensure each user has a `profiles` row with role set to one of: `owner`, `coach`, `athlete`, `parent`.

Example role update:

```sql
update profiles
set role = 'owner'
where email = 'your@email.com';
```

## 3) Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4) Current Implemented Flows

- Login via Supabase password auth at `/login`
- Role-aware routing from `/dashboard`
- Coach submits session (`pending` by default)
- Owner approves/rejects pending sessions
- Athlete books published sessions (tier/status gated)
- Coach records athlete feedback
- Parent sees linked athlete bookings and feedback

## 5) Next Recommended Steps

- Add Google Sheets sync via Supabase Edge Function cron
- Add Stripe checkout + webhook for subscription lifecycle
- Add server-side validation and stricter auditing for all writes
