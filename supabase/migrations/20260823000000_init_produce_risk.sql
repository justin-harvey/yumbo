-- ============================================================================
-- Produce Risk Scanner — initial schema
-- Supabase / PostgreSQL 15+
--
-- Design principle: risk is scored on commodity × origin × organic status.
-- Supplier (co-packer) data is modelled, but treated as sparse, hand-curated
-- reference material — NOT as an input to the risk score. See notes at bottom.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type product_form as enum ('fresh', 'frozen', 'canned', 'dried', 'juice');

create type evidence_strength as enum ('documented', 'inferred', 'disputed');

create type finding_type as enum (
  'pesticide_residue',
  'heavy_metal',
  'pathogen',
  'organic_fraud',
  'import_refusal'
);

-- ---------------------------------------------------------------------------
-- Reference: commodities
-- Risk tiers are 1 (low) .. 5 (high), sourced from USDA PDP, Consumer Reports,
-- and As You Sow. Store the provenance so methodology can be audited later.
-- ---------------------------------------------------------------------------

create table commodities (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  category             text not null,          -- 'berry', 'leafy_green', 'root', ...
  heavy_metal_tier     smallint not null check (heavy_metal_tier between 1 and 5),
  pesticide_tier       smallint not null check (pesticide_tier between 1 and 5),
  -- How much does buying organic actually reduce pesticide exposure for this
  -- crop? 0.0 = no effect (heavy-metal-dominated), 1.0 = near-total reduction.
  organic_pesticide_mitigation numeric(3,2) not null default 0.70
    check (organic_pesticide_mitigation between 0 and 1),
  notes                text,
  sources              jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column commodities.organic_pesticide_mitigation is
  'Organic certification reduces synthetic pesticide residue but has no effect on '
  'soil-derived heavy metals. Never apply this factor to heavy_metal_tier.';

-- ---------------------------------------------------------------------------
-- Reference: origins
-- ---------------------------------------------------------------------------

create table origins (
  id                   uuid primary key default gen_random_uuid(),
  country_code         char(2) not null,       -- ISO 3166-1 alpha-2
  region               text,                   -- optional sub-national region
  display_name         text not null,
  -- Multipliers applied to the base commodity tiers. 1.0 = neutral.
  pesticide_multiplier  numeric(3,2) not null default 1.00
    check (pesticide_multiplier between 0.5 and 2.0),
  heavy_metal_multiplier numeric(3,2) not null default 1.00
    check (heavy_metal_multiplier between 0.5 and 2.0),
  organic_fraud_risk   smallint not null default 1 check (organic_fraud_risk between 1 and 5),
  notes                text,
  sources              jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  unique (country_code, region)
);

-- ---------------------------------------------------------------------------
-- Brands and their corporate owners
-- NOTE: the GS1 prefix inside a UPC resolves to the *brand owner* (e.g. Kroger),
-- never to the co-packer. Do not infer manufacturer from barcode.
-- ---------------------------------------------------------------------------

create table brands (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  parent_company       text,                   -- e.g. 'Kroger', 'Albertsons'
  is_private_label     boolean not null default false,
  is_organic_line      boolean not null default false,
  gs1_prefixes         text[] not null default '{}',
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products — the barcode lookup table
-- ---------------------------------------------------------------------------

create table products (
  id                   uuid primary key default gen_random_uuid(),
  -- Normalised to GTIN-14 (left-pad UPC-A/EAN-13 with zeros) so a single
  -- lookup key works across symbologies. Text, never numeric: leading zeros.
  gtin                 text not null unique check (gtin ~ '^[0-9]{14}$'),
  display_name         text not null,
  brand_id             uuid references brands(id) on delete set null,
  commodity_id         uuid not null references commodities(id) on delete restrict,
  form                 product_form not null,
  is_organic           boolean not null default false,
  organic_certifier    text,
  -- Declared origin, when known. Fresh produce carries COOL labelling; frozen
  -- and canned frequently do not, hence nullable.
  origin_id            uuid references origins(id) on delete set null,
  origin_confidence    evidence_strength not null default 'inferred',
  net_weight_g         integer check (net_weight_g > 0),
  data_source          text,                   -- 'open_food_facts', 'manual', 'ocr'
  last_verified_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index products_commodity_idx on products (commodity_id);
create index products_brand_idx on products (brand_id);

-- ---------------------------------------------------------------------------
-- PLU codes — loose fresh produce has no barcode
-- 4-digit = conventional, 5-digit beginning with 9 = organic
-- ---------------------------------------------------------------------------

create table plu_codes (
  code                 text primary key check (code ~ '^[0-9]{4,5}$'),
  commodity_id         uuid not null references commodities(id) on delete restrict,
  display_name         text not null,
  is_organic           boolean not null
    generated always as (length(code) = 5 and left(code, 1) = '9') stored,
  size_descriptor      text
);

-- ---------------------------------------------------------------------------
-- Suppliers / co-packers — reference only, sparse by nature
-- ---------------------------------------------------------------------------

create table suppliers (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  display_name         text not null,
  hq_location          text,
  facility_locations   text[] not null default '{}',
  handles_forms        product_form[] not null default '{}',
  created_at           timestamptz not null default now()
);

create table supplier_brand_links (
  supplier_id          uuid not null references suppliers(id) on delete cascade,
  brand_id             uuid not null references brands(id) on delete cascade,
  evidence             evidence_strength not null,
  evidence_url         text,
  evidence_note        text,
  observed_at          date,                   -- when the relationship was documented
  created_at           timestamptz not null default now(),
  primary key (supplier_id, brand_id)
);

comment on table supplier_brand_links is
  'Co-packing contracts are usually confidential and rotate by season and region. '
  'Rows marked ''inferred'' must be surfaced to users as unconfirmed.';

-- ---------------------------------------------------------------------------
-- Contamination findings — the evidence log
-- Attaches to whichever entity the finding actually names.
-- ---------------------------------------------------------------------------

create table contamination_findings (
  id                   uuid primary key default gen_random_uuid(),
  kind                 finding_type not null,
  analyte              text,                   -- 'cadmium', 'acephate', ...
  commodity_id         uuid references commodities(id) on delete cascade,
  origin_id            uuid references origins(id) on delete cascade,
  supplier_id          uuid references suppliers(id) on delete cascade,
  brand_id             uuid references brands(id) on delete cascade,
  product_id           uuid references products(id) on delete cascade,
  reported_on          date not null,
  source_name          text not null,          -- 'FDA', 'USDA PDP', 'Consumer Reports'
  source_url           text,
  summary              text not null,
  created_at           timestamptz not null default now(),
  -- A finding must name at least one entity.
  constraint finding_targets_something check (
    num_nonnulls(commodity_id, origin_id, supplier_id, brand_id, product_id) > 0
  )
);

create index findings_commodity_idx on contamination_findings (commodity_id);
create index findings_reported_idx on contamination_findings (reported_on desc);

-- ---------------------------------------------------------------------------
-- Risk scoring
--
-- Two scores, deliberately kept separate — they behave differently and
-- averaging them into one number hides the fact that organic helps with one
-- and not the other.
-- ---------------------------------------------------------------------------

create or replace function pesticide_score(
  base_tier smallint,
  multiplier numeric,
  is_organic boolean,
  mitigation numeric
) returns numeric
language sql immutable as $$
  select round(
    least(5.0, base_tier * multiplier) *
    case when is_organic then (1 - mitigation) else 1 end,
  2);
$$;

create or replace function heavy_metal_score(
  base_tier smallint,
  multiplier numeric
) returns numeric
language sql immutable as $$
  -- Organic status is intentionally absent: heavy metals are soil-derived.
  select round(least(5.0, base_tier * multiplier), 2);
$$;

create view product_risk as
select
  p.id            as product_id,
  p.gtin,
  p.display_name,
  b.display_name  as brand_name,
  c.display_name  as commodity_name,
  c.category,
  p.form,
  p.is_organic,
  o.display_name  as origin_name,
  p.origin_confidence,
  pesticide_score(
    c.pesticide_tier,
    coalesce(o.pesticide_multiplier, 1.00),
    p.is_organic,
    c.organic_pesticide_mitigation
  ) as pesticide_score,
  heavy_metal_score(
    c.heavy_metal_tier,
    coalesce(o.heavy_metal_multiplier, 1.00)
  ) as heavy_metal_score,
  -- Flag when origin is unknown so the UI can show reduced confidence
  (p.origin_id is null) as origin_unknown
from products p
  join commodities c on c.id = p.commodity_id
  left join brands b on b.id = p.brand_id
  left join origins o on o.id = p.origin_id;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger commodities_updated_at before update on commodities
  for each row execute function set_updated_at();
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reference data is world-readable; writes are restricted to curators.
-- ---------------------------------------------------------------------------

alter table commodities            enable row level security;
alter table origins                enable row level security;
alter table brands                 enable row level security;
alter table products               enable row level security;
alter table plu_codes              enable row level security;
alter table suppliers              enable row level security;
alter table supplier_brand_links   enable row level security;
alter table contamination_findings enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'commodities','origins','brands','products','plu_codes',
    'suppliers','supplier_brand_links','contamination_findings'
  ] loop
    execute format(
      'create policy %I_public_read on %I for select using (true)',
      t, t
    );
    execute format(
      'create policy %I_curator_write on %I for all to authenticated
         using (auth.jwt() ->> ''role'' = ''curator'')
         with check (auth.jwt() ->> ''role'' = ''curator'')',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: commodities
-- Tiers reflect Consumer Reports (2024) pesticide analysis and As You Sow /
-- peer-reviewed accumulation data for heavy metals.
-- ---------------------------------------------------------------------------

insert into commodities
  (slug, display_name, category, heavy_metal_tier, pesticide_tier,
   organic_pesticide_mitigation, notes)
values
  ('spinach',     'Spinach',      'leafy_green', 5, 3, 0.75,
   'Highest documented cadmium accumulator; organic offers no metal benefit.'),
  ('kale',        'Kale',         'leafy_green', 4, 4, 0.75, null),
  ('carrot',      'Carrot',       'root',        4, 2, 0.70,
   'Root crop; cadmium and lead uptake from soil.'),
  ('sweet_potato','Sweet potato', 'root',        4, 2, 0.70, null),
  ('potato',      'Potato',       'root',        3, 4, 0.75, null),
  ('strawberry',  'Strawberry',   'berry',       2, 5, 0.85,
   'Highest-risk imported samples concentrated in Mexican-grown fruit.'),
  ('blueberry',   'Blueberry',    'berry',       2, 5, 0.85, null),
  ('green_bean',  'Green bean',   'legume',      2, 5, 0.85,
   'Banned organophosphates (acephate, methamidophos) repeatedly detected.'),
  ('bell_pepper', 'Bell pepper',  'fruiting',    2, 5, 0.85, null),
  ('peach',       'Peach',        'stone_fruit', 2, 4, 0.85, null),
  ('pea',         'Pea',          'legume',      1, 2, 0.70, null),
  ('broccoli',    'Broccoli',     'brassica',    2, 2, 0.70, null),
  ('winter_squash','Winter squash','gourd',      2, 2, 0.70, null);

-- ---------------------------------------------------------------------------
-- Seed: origins
-- ---------------------------------------------------------------------------

insert into origins
  (country_code, region, display_name, pesticide_multiplier,
   heavy_metal_multiplier, organic_fraud_risk, notes)
values
  ('US', null, 'United States',        1.00, 1.00, 1, null),
  ('MX', null, 'Mexico',               1.40, 1.00, 2,
   'Majority of highest-risk imported samples in CR 2024 analysis.'),
  ('CA', null, 'Canada',               0.95, 1.00, 1, null),
  ('PE', null, 'Peru',                 1.15, 1.10, 2, null),
  ('CL', null, 'Chile',                1.10, 1.00, 1, null),
  ('CN', null, 'China',                1.30, 1.50, 3,
   'Paddy and vegetable soils with documented cadmium/arsenic burden.'),
  ('TR', null, 'Turkey',               1.20, 1.10, 4,
   'Black Sea organic certification fraud; certifier suspensions 2018-2019.'),
  ('IN', null, 'India',                1.25, 1.30, 4, null);

-- ============================================================================
-- Implementation notes
--
-- 1. Barcode lookup: normalise scanned UPC-A (12) / EAN-13 (13) to GTIN-14 by
--    left-padding with zeros before querying products.gtin.
--
-- 2. Cache commodities, origins and plu_codes on-device (SQLite/MMKV) — they
--    are small and change rarely. Grocery-store connectivity is unreliable and
--    a HUD that blocks on a round trip reads as broken.
--
-- 3. Keep scoring in pesticide_score() / heavy_metal_score() rather than the
--    client so methodology revisions ship without an app release.
--
-- 4. supplier_brand_links deliberately does not feed the risk score. Public
--    co-packer data is sparse and mostly derived from pathogen recalls; using
--    it to rank chemical risk would manufacture false precision.
-- ============================================================================
