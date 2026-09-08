-- ============================================================================
-- Community submissions — crowdsourced catalog expansion.
--
-- Design: submissions are kept OUT of the curated `products` table so the
-- hand-curated scoring guarantee holds. They are scored through the same SQL
-- functions and surfaced immediately to everyone, but always flagged
-- verified = false (invariant #7: inferred data must be distinguishable).
--
-- Writes require an authenticated identity. The app uses Supabase Anonymous
-- Sign-in, so "authenticated" here includes anonymous device identities — which
-- is what lets us attribute and later rate-limit submissions.
-- ============================================================================

create type submission_status as enum ('pending', 'approved', 'rejected');

create table product_submissions (
  id             uuid primary key default gen_random_uuid(),
  gtin           text not null check (gtin ~ '^[0-9]{14}$'),
  display_name   text not null,
  -- Required: scoring is meaningless without a commodity mapping. This mapping
  -- is the crowdsourced value — OFF categories do not match our taxonomy.
  commodity_id   uuid not null references commodities(id) on delete restrict,
  brand_name     text,                       -- free text from OFF, not the brands table
  is_organic     boolean not null default false,
  origin_id      uuid references origins(id) on delete set null,
  off_data       jsonb,                      -- raw Open Food Facts snapshot
  status         submission_status not null default 'pending',
  submitted_by   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index submissions_gtin_idx on product_submissions (gtin);
create index submissions_status_idx on product_submissions (status);

alter table product_submissions enable row level security;

-- Everyone can read non-rejected submissions (they are meant to be shared).
create policy submissions_public_read on product_submissions
  for select using (status <> 'rejected');

-- Curators can see everything, including rejected, for moderation.
create policy submissions_curator_read on product_submissions
  for select to authenticated
  using (auth.jwt() ->> 'role' = 'curator');

-- Any signed-in identity (incl. anonymous) may add a pending submission, and
-- only as themselves. They cannot self-approve.
create policy submissions_insert_own on product_submissions
  for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending');

-- A contributor may edit or withdraw their own submission while it is pending.
create policy submissions_update_own on product_submissions
  for update to authenticated
  using (submitted_by = auth.uid() and status = 'pending')
  with check (submitted_by = auth.uid() and status = 'pending');

create policy submissions_delete_own on product_submissions
  for delete to authenticated
  using (submitted_by = auth.uid() and status = 'pending');

-- Curators can moderate (change status, promote to products out of band).
create policy submissions_curator_write on product_submissions
  for update to authenticated
  using (auth.jwt() ->> 'role' = 'curator')
  with check (auth.jwt() ->> 'role' = 'curator');

-- ---------------------------------------------------------------------------
-- Unified read model: curated products + community submissions, scored the
-- same way. One row per GTIN, preferring the verified (curated) entry, then the
-- most recent submission. The app queries this view by gtin.
-- ---------------------------------------------------------------------------

create view catalog_risk as
select distinct on (u.gtin) u.*
from (
  select
    'curated'::text                   as source,
    true                              as verified,
    null::uuid                        as submission_id,
    pr.product_id,
    pr.gtin,
    pr.display_name,
    pr.brand_name,
    pr.commodity_name,
    pr.category,
    pr.form::text                     as form,
    pr.is_organic,
    pr.origin_name,
    pr.origin_confidence::text        as origin_confidence,
    pr.pesticide_score,
    pr.heavy_metal_score,
    pr.origin_unknown,
    p.created_at                      as created_at
  from product_risk pr
    join products p on p.id = pr.product_id

  union all

  select
    'community'::text                 as source,
    false                             as verified,
    s.id                              as submission_id,
    null::uuid                        as product_id,
    s.gtin,
    s.display_name,
    s.brand_name,
    c.display_name                    as commodity_name,
    c.category,
    null::text                        as form,
    s.is_organic,
    o.display_name                    as origin_name,
    'inferred'::text                  as origin_confidence,
    pesticide_score(
      c.pesticide_tier,
      coalesce(o.pesticide_multiplier, 1.00),
      s.is_organic,
      c.organic_pesticide_mitigation
    )                                 as pesticide_score,
    heavy_metal_score(
      c.heavy_metal_tier,
      coalesce(o.heavy_metal_multiplier, 1.00)
    )                                 as heavy_metal_score,
    (s.origin_id is null)             as origin_unknown,
    s.created_at                      as created_at
  from product_submissions s
    join commodities c on c.id = s.commodity_id
    left join origins o on o.id = s.origin_id
  where s.status <> 'rejected'
) u
order by u.gtin, u.verified desc, u.created_at desc;
