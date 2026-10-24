-- ---------------------------------------------------------------------
-- Ask the policies a question without reading all of them
--
-- The assistant was handed every policy, in full, on every question: 80
-- documents, 1,274,390 characters, roughly 318,000 tokens a prompt. Two
-- questions used up the day's Gemini quota. The browser also downloaded
-- all of it, because the page picked which documents to send client-side,
-- so opening the assistant cost 1.27MB before anybody typed anything.
--
-- This returns the handful of passages that bear on the question instead.
-- Measured over six realistic questions it sends 5,000-20,000 characters
-- rather than 1,274,390 -- between 98.4% and 99.6% less.
--
-- Three things decide which passages:
--
--   1. Which documents mention the question at all, using the GIN index
--      on to_tsvector(title || ' ' || content). That index has existed
--      since 0009 and nothing had ever used it.
--
--   2. Which window of each document. A 3,000-character window of a
--      61,000-character policy is five percent of it, so the window is
--      slid across the document and scored rather than anchored on the
--      first matching word, which landed on whichever paragraph merely
--      shared vocabulary with the question.
--
--   3. Which words count. Scoring by how many question words a window
--      contains picked the glossary every time, because a definitions
--      section says Scout, Troop, Crew and Activity more often than the
--      clause that answers anything. Each word is weighted by
--      ln(documents / documents containing it), so "ratio" -- in two
--      documents -- outweighs "scout", which is in all eighty.
--
-- The window is cut with substring(), deliberately, and not with
-- ts_headline. ts_headline collapses whitespace and stitches fragments
-- together, so its output is not a literal substring of the document.
-- This whole feature rests on every quote being checkable against the
-- text it came from; a stitched passage would let a quote pass that check
-- while spanning a gap the reader cannot see. A substring cannot.
--
-- SECURITY INVOKER, so a Pending or Rejected account reading this gets
-- what the policies table's own RLS gives it, which is nothing.
-- ---------------------------------------------------------------------
create or replace function public.search_policy_passages(
  p_question text,
  p_limit    integer default 8,
  p_window   integer default 2500,
  p_per_doc  integer default 2
)
returns table (policy_id uuid, seq integer, title text, passage text, rank real)
language sql
stable
set search_path = public
as $fn$
  with q as (
    select
      websearch_to_tsquery('english', coalesce(p_question, '')) as tsq,
      (
        select array_agg(distinct w)
          from unnest(regexp_split_to_array(lower(coalesce(p_question, '')), '[^a-z0-9]+')) as w
         where length(w) > 3
      ) as terms
  ),
  corpus as (select count(*)::numeric as n from public.policies),
  -- How many documents each question word appears in. Eighty documents is
  -- few enough to just count, and this is what stops common words from
  -- dragging the answer into a glossary.
  weights as (
    select t.term,
           ln(c.n / greatest(
             (select count(*) from public.policies p where p.content ilike '%' || t.term || '%'),
             1
           )) + 0.05 as w
      from q, corpus c, unnest(q.terms) as t(term)
  ),
  -- Narrow to documents that mention the question before doing any
  -- per-window work.
  candidates as (
    select p.id, p.title, p.content,
           ts_rank(to_tsvector('english', p.title || ' ' || p.content), q.tsq) as r
      from public.policies p, q
     where q.tsq is not null
       and to_tsvector('english', p.title || ' ' || p.content) @@ q.tsq
     order by r desc
     limit 12
  ),
  -- Overlapping, so a clause that straddles a boundary is whole in the
  -- next window along.
  windows as (
    select c.id, c.title, c.r, off,
           substring(c.content from off for p_window) as passage
      from candidates c,
           generate_series(
             1,
             greatest(1, length(c.content) - (p_window / 2)),
             greatest(1, p_window / 2)
           ) as off
  ),
  scored as (
    select w.id, w.title, w.r, w.off, w.passage,
           coalesce((
             select sum(wt.w)
               from weights wt
              where position(wt.term in lower(w.passage)) > 0
           ), 0) as score
      from windows w
  ),
  ranked as (
    select *,
           row_number() over (partition by id order by score desc, off) as doc_seq
      from scored
  )
  select id,
         -- Returned so the caller can give each passage an id of its own.
         -- Two passages of one policy must not share one, or a quote from
         -- the first gets checked against the second and thrown away.
         (row_number() over (order by score desc, r desc))::integer as seq,
         title,
         passage,
         r
    from ranked
   where doc_seq <= greatest(1, least(p_per_doc, 4))
     and score > 0
   order by score desc, r desc
   limit greatest(1, least(p_limit, 20));
$fn$;

comment on function public.search_policy_passages(text, integer, integer, integer) is
  'Ranked, contiguous excerpts of the policies relevant to a question: the best few windows of each matching document, scored on inverse-document-frequency-weighted question terms and ranked across documents. Cut with substring(), so each passage is a literal substring of its policy and a quote can be checked against it. Pair policy_id with seq to make a unique id per passage.';
