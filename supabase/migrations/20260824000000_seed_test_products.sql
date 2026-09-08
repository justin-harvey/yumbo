-- ============================================================================
-- Seed a few real, scannable products so the scanner returns scored rows.
-- Idempotent (ON CONFLICT DO NOTHING) so it is safe to re-run.
--
-- GTINs are stored as GTIN-14 (UPC-A left-padded with zeros), matching the
-- client's normaliseToGtin14(). data_source = 'test' marks these as fixtures.
-- ============================================================================

-- Bananas were not in the initial commodity seed. Thick inedible peel keeps them
-- consistently among the lowest pesticide-residue produce; low soil-metal uptake.
insert into commodities
  (slug, display_name, category, heavy_metal_tier, pesticide_tier,
   organic_pesticide_mitigation, notes)
values
  ('banana', 'Banana', 'tropical', 1, 1, 0.70,
   'Thick inedible peel; consistently among the lowest pesticide-residue produce.')
on conflict (slug) do nothing;

-- Justin's real organic-banana UPC (074904100012 -> GTIN-14 00074904100012).
-- Origin left unknown to exercise the reduced-confidence path (invariant #6),
-- and organic so the pesticide score reflects the mitigation factor.
insert into products
  (gtin, display_name, commodity_id, form, is_organic, origin_id,
   origin_confidence, data_source)
select
  '00074904100012', 'Organic Bananas',
  (select id from commodities where slug = 'banana'),
  'fresh', true, null, 'inferred', 'test'
on conflict (gtin) do nothing;

-- Conventional strawberries from Mexico: high pesticide tier x MX multiplier
-- (from UPC-A 036000291452). Demonstrates a high pesticide / low metal split.
insert into products
  (gtin, display_name, commodity_id, form, is_organic, origin_id,
   origin_confidence, data_source)
select
  '00036000291452', 'Strawberries',
  (select id from commodities where slug = 'strawberry'),
  'fresh', false,
  (select id from origins where country_code = 'MX' and region is null),
  'documented', 'test'
on conflict (gtin) do nothing;

-- Conventional baby spinach from the US: high heavy-metal tier, moderate
-- pesticide (from UPC-A 012345678905). The inverse split from strawberries.
insert into products
  (gtin, display_name, commodity_id, form, is_organic, origin_id,
   origin_confidence, data_source)
select
  '00012345678905', 'Baby Spinach',
  (select id from commodities where slug = 'spinach'),
  'fresh', false,
  (select id from origins where country_code = 'US' and region is null),
  'documented', 'test'
on conflict (gtin) do nothing;
