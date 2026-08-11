# BaseMind

Equipment, camp and food management for a single Scout group, with role-based access control.

## What it does

- **Equipment** — inventory browsable by room or by category, with condition tracking
- **Calendar** — camps, hikes and meetings on a month view, plus what's coming up
- **Camping sites** — a directory of venues with phone numbers, addresses and descriptions
- **Food store** — what's in the cupboard, in whatever units suit (kg, tins, litres)
- **Camp plans** — per-event equipment packing lists and food requirements, with a shopping
  list worked out automatically from what the food store doesn't already cover
- **PDF export** — the whole camp plan, site contact details included, as a printable download

## Stack

React 18 + TypeScript + Vite + Tailwind CSS v4 + Radix/shadcn UI components, backed by Supabase
(Postgres + Auth + Row Level Security + Realtime). PDF generation via jsPDF, loaded on demand.

## Roles

| Role | Equipment, camps, sites, food | Users |
|---|---|---|
| **Admin** | full CRUD | approve/reject signups, change roles, deactivate |
| **Manager** | full CRUD | — |
| **Member** | add / edit, no delete | — |
| **Viewer** | read-only | — |

Access is enforced **in the database** via Postgres Row Level Security, not just hidden in the
UI — see `supabase/migrations/`. A Viewer (or a Pending account) cannot write to any table even
by calling the Supabase REST API directly.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a new project at [supabase.com](https://supabase.com/dashboard). You'll need its
**Project URL** and **anon/public key** from Project Settings → API.

### 3. Run the schema

Open the SQL Editor in your Supabase project and run the migrations in
[`supabase/migrations/`](./supabase/migrations/) **in order, once each**:

| Migration | What it adds |
|---|---|
| `0001_init.sql` | `users` and `equipment` tables, signup trigger, RLS policies |
| `0002_fix_admin_bootstrap.sql` | Lets the first-admin promotion in step 7 actually apply |
| `0003_camps_and_food.sql` | Camping sites, events, packing lists, food store, camp food plans |

If you already set the project up, run whichever ones you haven't yet — the app's calendar,
sites and food pages will error until `0003` has been applied.

(If you're using the Supabase CLI locally instead: `supabase link` then `supabase db push`.)

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 2.

### 5. Run it

```bash
npm run dev
```

### 6. Decide on email confirmation

Supabase turns on **Confirm email** by default, so every new account must click a link before it
can sign in. This app already gates access behind admin approval, so that confirmation step is
mostly redundant friction for a small group.

To turn it off: Supabase Dashboard → Authentication → Providers → Email → toggle off
**Confirm email**. Leave it on only if you want addresses verified for future password resets.

If you leave it on, sign-in fails with `Email not confirmed` until the link is clicked. You can
always confirm an address manually from the SQL Editor:

```sql
update auth.users set email_confirmed_at = now() where email = 'you@example.com';
```

### 7. Create the first Admin

There's no admin yet to approve the first signup, so:

1. Go to `/register` in the running app and create an account. It'll land you on a "pending
   approval" screen.
2. In the Supabase SQL Editor, run (with your own email):

   ```sql
   update public.users set role = 'Admin', status = 'Active' where email = 'you@example.com';
   ```

   Note this touches `public.users` (role/status) only — it does **not** confirm the email
   address. That's the separate `auth.users` step in step 6.

3. Sign out and back in — you'll land on the Equipment page with a "Users" tab for approving
   everyone else.

To check the signup trigger created your profile row correctly:

```sql
select id, email, role, status from public.users;
```

### 8. Optional: load sample data

To see the app with something in it, run
[`supabase/seed/dummy_data.sql`](./supabase/seed/dummy_data.sql) in the SQL Editor. It adds
fictional equipment across four rooms and six categories, four camping sites, a food store, and
five events — one past, one running now, three upcoming — two of which have full packing lists
and food plans.

Every seeded row is named with a `[sample]` prefix. Re-running the file replaces its own rows
rather than duplicating them, and
[`supabase/seed/remove_dummy_data.sql`](./supabase/seed/remove_dummy_data.sql) removes all of it
without touching anything you added yourself.

## Deploying (GitHub + Vercel)

1. **Push to GitHub.** From `basemind-app/`:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

   (Create the empty repo on GitHub first — via the web UI or `gh repo create`.)

2. **Import into Vercel.** On [vercel.com/new](https://vercel.com/new), import the GitHub repo.
   Vercel reads `vercel.json` and auto-detects the Vite framework — you shouldn't need to touch
   the build settings.

3. **Set environment variables in Vercel.** Project Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (Same values as your local `.env.local`, for the Production/Preview/Development environments
   you want live.) Redeploy after adding them if the first deploy already ran.

4. **Supabase Auth redirect URL.** If email confirmation is on (Supabase Auth → Providers →
   Email), add your Vercel domain to Authentication → URL Configuration → Redirect URLs, or
   confirmation links will bounce back to `localhost`.

Order matters a bit: get the Supabase project + schema (above) done first, since Vercel needs
those env vars at build/runtime.

## Verifying it works

- [ ] `npm run dev` boots with no console errors; the purple theme applies.
- [ ] Register a second test account, approve it as each role in turn (Manager, Member, Viewer)
      via the Users page, and confirm each sees exactly the equipment controls their role allows.
- [ ] A Viewer or Pending account cannot reach `/users` (redirected away).
- [ ] **The real test**: with a Viewer's session, try a direct write against the Supabase REST
      `equipment` endpoint (bypassing the UI) and confirm Postgres rejects it — this is the
      server-side enforcement the old app never had.
- [ ] Two browser sessions as different Active users: edit equipment in one tab, watch it appear
      live in the other without a refresh.
- [ ] Admin rejects a user → that account is immediately locked out of equipment access.

## What's deliberately not here

Camp planning, camping locations, document management, the AI chatbot, reports, and multi-group
support — all cut from the original app. This is intentionally just equipment + roles, built to
actually work before anything else gets added back.
