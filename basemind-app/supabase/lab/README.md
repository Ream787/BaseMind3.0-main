# The `lab` schema

Everything on the `lab-everything` branch that needed a database lives in a
Postgres schema called `lab`, not in `public`.

That is the whole design decision, and it is worth two minutes.

## Why

The branch adds nineteen features and thirty-six tables in one go. Putting
them in `public` would mean the experiment and the working app share a
namespace, a backup and a blast radius — one bad migration here and the
group's real equipment inventory is in the way of the fix.

Keeping them in their own schema buys three things:

1. **The app is untouched.** No file in this directory alters a `public`
   table, column, row or policy. The only references across the line are
   foreign keys, which read `public` rows and never change them.
2. **Removal is one command.** [`drop_lab.sql`](./drop_lab.sql) takes the
   whole thing away and leaves BaseMind exactly as `supabase/migrations/`
   describes it. No hunting through forty tables working out which were
   ours.
3. **One project, one login.** Both schemas live in the same Supabase
   project, so there is no second URL, no second anon key and no second set
   of accounts to keep in step.

The deliberate exception is the auth helpers: policies here call
`public.is_active_user()` and `public.current_role()` rather than
re-deriving them, because "who is an active Admin" must have exactly one
answer across the whole database. Dropping `lab` does not touch those.

## Installing

Run these in the Supabase SQL editor, in order, once each:

| File | What it does |
|---|---|
| `0001_lab_schema.sql` | The schema, 36 tables, RLS, grants, realtime, the photo bucket and the feature switches |
| `0002_lab_functions.sql` | Seven functions — standings, roll call, stocktake snapshots, the dashboard |
| `0003_lab_seed.sql` | Optional. Demonstration data: six patrols, 25 members, badges, activities, kit lists |

Then — and this is the step everybody misses —

**Project Settings → API → Exposed schemas: add `lab` next to `public`.**

PostgREST will not serve a schema it has not been told about. Until you do
this, every request comes back `PGRST106 Invalid schema: lab`, however
correct the tables are. The app recognises that exact code and shows the
setup instructions rather than an error, so if you see them, this is the
step you want.

## Removing

```sql
-- supabase/lab/drop_lab.sql
```

It unpublishes the tables from the realtime publication, drops the storage
policies and the `lab-photos` bucket, then `drop schema lab cascade`.
Afterwards the app's own pages carry on exactly as before and the extra nav
sections disappear on their own, because the front end hides them when the
schema is unreachable.

## What is in here

**People** — `patrols`, `members`, `attendance`

`members` are the young people. They are *not* app users: an eleven-year-old
does not get a login, and their medical details must not hang off an account
anybody could sign into. `public.users` stays what it always was — the
leaders who run the app — and the two never merge.

**Progression** — `badges`, `badge_requirements`, `member_badges`,
`member_requirements`

Requirements are tracked separately from awarded badges, because a member
three requirements into Navigator has done something, and a schema that can
only record "no badge yet" throws that away.

**Points** — `point_awards`

A ledger, not a running total on the patrol row. "Who gave us those twenty
points and what for" is the question that actually gets asked, and an integer
cannot answer it. `lab.patrol_standings()` sums it.

**Programme** — `activities`, `programmes`, `programme_slots`

Slots copy their title rather than reading it through the activity link, so
editing the library never rewrites what last term's programme says happened.

**Camp operations** — `tasks`, `duties`, `expenses`, `budgets`,
`risk_assessments`, `risk_lines`, `incidents`

Money is integer minor units everywhere. Money in a float is how a camp
budget ends up three pence out with nobody able to find where.

**Communication** — `announcements`, `announcement_reactions`, `messages`,
`polls`, `poll_options`, `poll_votes`

Reactions and votes are one row per person per thing, which is more rows than
a counter and the only version that can answer "have I already voted" without
trusting the browser to remember.

**Equipment, continued** — `maintenance_logs`, `stocktakes`,
`stocktake_entries`, `wishlist`, `wishlist_votes`

`stocktake_entries.expected_quantity` is snapshotted when counting starts. If
it read through to `public.equipment` instead, somebody editing the inventory
mid-count would silently change what the count was being compared against,
and the discrepancy — the entire point — would vanish.

**Camp extras** — `kit_lists`, `kit_list_items`, `site_reviews`, `photos`

**Meta** — `feature_flags`, `settings`, `audit_log`

Lab has its own `feature_flags` rather than adding rows to the app's. Sharing
that table would have been shorter, right up until somebody ran `drop_lab.sql`
and was left with nineteen switches for pages that no longer exist.

## Security

Every table has RLS enabled. The common case is four policies — read if you
are signed in and approved, write if you are Member or above, delete if you
are a leader — applied in a loop rather than copy-pasted thirty times,
because thirty copies is thirty chances to leave one table open.

Five tables have rules of their own:

- `announcements` — only leaders post
- `announcement_reactions`, `poll_votes`, `wishlist_votes` — you may add and
  remove **your own** and nobody else's, which the shared delete policy would
  have permitted by accident
- `messages` — you post as yourself; only leaders remove a row outright
- `feature_flags` and `settings` — Admin only

Grants and RLS are both required: RLS decides what a request may touch, and
without a grant PostgREST never gets far enough to ask. A grant on its own is
not a permission.

## Photos

`lab-photos` is a **private** bucket and the gallery signs URLs on the fly.
That matters more here than anywhere else in the app: these are pictures of
other people's children, and a public bucket is public whether or not anybody
has the link.
