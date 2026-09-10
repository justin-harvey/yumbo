-- ============================================================================
-- PLU support for loose produce (M8).
--
-- Loose produce has no barcode and no packaged origin, so it is scored on
-- commodity + organic only, with a neutral (1.0) origin multiplier and origin
-- treated as unknown. is_organic is derived from the code (5 digits starting
-- with 9), never asked of the user.
-- ============================================================================

create view plu_risk as
select
  pc.code,
  pc.display_name,
  c.display_name as commodity_name,
  c.category,
  pc.is_organic,
  pesticide_score(
    c.pesticide_tier, 1.00, pc.is_organic, c.organic_pesticide_mitigation
  ) as pesticide_score,
  heavy_metal_score(c.heavy_metal_tier, 1.00) as heavy_metal_score
from plu_codes pc
  join commodities c on c.id = pc.commodity_id;

-- Seed the canonical banana PLUs (IFPS 4011 conventional, 94011 organic) as a
-- working example. The broader IFPS set can only be loaded for commodities we
-- actually have tiers for — expand commodities first, then import PLUs.
insert into plu_codes (code, commodity_id, display_name)
select '4011', (select id from commodities where slug = 'banana'), 'Banana'
on conflict (code) do nothing;

insert into plu_codes (code, commodity_id, display_name)
select '94011', (select id from commodities where slug = 'banana'), 'Banana'
on conflict (code) do nothing;
