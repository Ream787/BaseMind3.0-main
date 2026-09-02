# BaseMind

Equipment, camp and food management for a single Scout group, with role-based access control.

## What it does

- **Equipment** — inventory browsable by room or by category, with condition tracking
- **Storage places** — boxes, shelves and cupboards nested inside a room up to five deep,
  each with a QR sticker, so "where is it" is answered down to the shelf
- **Calendar** — camps, hikes and meetings on a month view, plus what's coming up
- **Camping sites** — a directory of venues with phone numbers, addresses and descriptions
- **Reporting a bug** — from the account menu on any page, with the page and browser
  collected automatically; admins triage them in Admin
- **Borrowing** — who has what, from which group, and when it's due back, with availability
  taken off the equipment list while it's out
- **Food store** — what's in the cupboard, in whatever units suit (kg, tins, litres)
- **Menus** — plan meals per day for a camp; save the good ones to a library filtered by
  length and type (2-day hiking, weekend camping…) and reuse them, scaled to the group size
- **Camp plans** — per-event equipment packing lists and food requirements, with a shopping
  list worked out automatically from what the food store doesn't already cover
- **Camp wizard** — set a new camp up in one pass: dates, site, headcount, menu, equipment
- **Safety plans** — emergency contacts, nearest hospital, and what to do per situation, written
  up as a printable document
- **PDF export** — the whole camp plan, site contact details included, as a printable download
- **Form filling** — upload an official fillable PDF once, map its boxes to camp data, then
  generate filled copies per camp
- **Policies** — the group's rule documents, searchable, with an assistant that answers
  questions by quoting them
- **Person icons** — everyone gets a little camp badge beside their name, worked out from
  their account so it is there from day one; pick your own emblem and colour, or use your
  initials instead

## Safety plans and the AI rewrite

The safety plan is built from what you type in — nothing is looked up, inferred or supplied by
the app. The default document is rendered by a plain template, so it works with no API key and
can only ever restate your own data.

There is also an optional **"Rewrite more readably"** button that sends those same facts to
Gemini to be phrased as flowing paragraphs. It is constrained in three ways:

1. The API key lives in a Supabase Edge Function, never in the browser bundle.
2. The model is told to use only the supplied facts and invent nothing.
3. That instruction is **not trusted** — every number in the reply is checked against your data
   before it is shown, and a reply containing an unrecognised number is discarded rather than
   displayed. You keep the plain version.

To enable it: Supabase dashboard → Edge Functions → create a function named `safety-plan`, paste
[`supabase/functions/safety-plan/index.ts`](./supabase/functions/safety-plan/index.ts), and set a
`GEMINI_API_KEY` secret. Without it the button simply errors and the template still works.

Whatever produces it, read the plan before you rely on it.

## The assistant

**Assistant** is its own section in the nav, with two tabs: **Ask** and **Documents**.

Add the group's policy documents as PDFs — upload a file, or paste a link straight to one and
it is downloaded for you. The text is extracted when it arrives and stored alongside the
original, so the documents stay searchable — and readable — with no API key.

Adding a document whose name you already have **replaces** it rather than adding a second
copy: two copies means the assistant quotes whichever it read first, and an edit to one
silently doesn't apply. A document added by link keeps that link, so the ↻ button next to it
re-downloads and replaces it in place when the source is updated.

The **Ask** tab answers questions from that extracted text and nothing else. Every answer
carries verbatim quotes, and each quote is checked against the stored document before it is
shown: a reply quoting something that isn't in your policies is discarded rather than
displayed. Only Admins and Managers can add or change documents, because an answer is only as
trustworthy as who can edit what it answers from.

Conversations are **saved and private to whoever asked** — row-level security enforces that,
not just the UI. Nothing is written until an answer actually arrives, so a failed question
leaves no half-conversation behind. Only the last **three exchanges** are replayed to the
model: enough for "and what about cubs?" to make sense, without pushing the documents down a
prompt that grows every turn.

To enable it: Supabase dashboard → Edge Functions → create a function named `policy-chat`,
paste [`supabase/functions/policy-chat/index.ts`](./supabase/functions/policy-chat/index.ts),
and set the same `GEMINI_API_KEY` secret. Without it the documents still upload, search and
open — only the question box errors.

For **adding a policy by link**, create a second function named `fetch-policy-pdf` and paste
[`supabase/functions/fetch-policy-pdf/index.ts`](./supabase/functions/fetch-policy-pdf/index.ts).
It needs no secrets. Downloading happens there rather than in the browser because almost
nothing serves a PDF with headers that allow a cross-origin read. It refuses anything that
isn't really a PDF, caps downloads at 15 MB, checks every redirect hop, and blocks private and
cloud-metadata addresses — it is fetching a URL somebody typed, from inside your
infrastructure. Uploading files works without it.

### Choosing the Gemini model

Both functions default to `gemini-3.5-flash-lite`, chosen for the free tier: Flash Lite is the
cheapest class and gets the most generous free quota. Its thinking level already defaults to
minimal, so none of the output budget goes on reasoning.

To use a different model, set a **`GEMINI_MODEL`** secret — no code change needed.

If the model name isn't available on your key, the call fails with a 404 and the error names
the model it tried **and lists the models your key can actually use**, so there's no guessing.
Note that edge functions don't update from a git push: after editing one here you have to paste
it into the dashboard again.

## Person icons

Everyone has a badge — a camp emblem in one of eight colours — shown in the header and
anywhere people are listed. It is worked out from the user's id in the browser, so:

- a new account has one immediately, with nothing to upload and nothing to set up
- it is the same on every device, and it still draws with no connection
- there is no state in which somebody has no icon

Sixteen emblems and eight colours give 128 badges, which is enough that a group's worth of
people rarely collide. The colours are the `--avatar-N` variables in the stylesheet, so they
swap for dark mode along with everything else.

**Your profile → Your icon** lets you pin an emblem and a colour instead of taking the ones
your id chose, or switch to your initials if you'd rather have letters than a picture. Two
optional columns store that; "Start again" clears them and hands the choice back to your id.

No image is uploaded, generated or hosted anywhere — the badge is drawn by the app.

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
| `0002_fix_admin_bootstrap.sql` | Nothing on a fresh project — see the note in the file |
| `0003_camps_and_food.sql` | Camping sites, events, packing lists, food store, camp food plans |
| `0004_equipment_loans.sql` | Borrowing: who has what, and when it's due back |
| `0005_menus.sql` | Menus, meals and ingredients, plus event headcount |
| `0006_safety.sql` | Hospital/emergency details per site, and per-camp safety plans |
| `0007_camp_forms.sql` | Uploaded fillable PDF forms and their field mappings |
| `0008_feature_flags.sql` | The switches on the admin page for turning features off |
| `0009_policies.sql` | Policy documents, their extracted text, and the `policies` bucket |
| `0010_user_icons.sql` | The emblem and colour each person picked for their badge |

If you already set the project up, run whichever ones you haven't yet — the app's calendar,
sites and food pages will error until `0003` has been applied. `0002` and `0010` are safe to
run twice; the rest are not, so keep track of which you have done.

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

### 6b. Where confirmation links point, and who sends them

Two settings, in two different places, and a link is broken if either is wrong.

**Where the link lands** — Authentication → URL Configuration:

- **Site URL** must be the full origin *including the scheme*: `https://www.basemind.co.za`,
  not `www.basemind.co.za`. Without it Supabase treats the value as a path and the link
  redirects to `https://<project>.supabase.co/www.basemind.co.za`, which is a 404 on somebody
  else's domain.
- **Redirect URLs** must list `https://www.basemind.co.za/**`. The app asks to come back to
  `/auth/callback`; anything not matching this list is silently ignored in favour of the Site
  URL, which is a failure with no error message anywhere.

**Who sends it** — Project Settings → Authentication → SMTP Settings. The built-in sender is
rate-limited to a couple of emails an hour and is not meant for real use, so a group of any
size needs its own. Any transactional provider works; the domain has to be verified with the
provider first, which means adding SPF, DKIM and DMARC records at whoever runs the domain's
DNS.

Send from a subdomain (`send.basemind.co.za`) rather than the root. The root's MX records
belong to wherever the group actually reads mail, and a sending subdomain keeps the two from
interfering — including when a provider asks for its own MX record to handle bounces.

Set the sender address to something that exists. `noreply@` is conventional, but replies and
bounce reports go somewhere, and "somewhere" should not be a mailbox nobody has created.

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
