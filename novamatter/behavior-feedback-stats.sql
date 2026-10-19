-- Selected source: NovaLife/supabase/migrations/002_novamatter_novalife_behavior_filter.sql, lines 61-75.
-- This view depends on application tables intentionally not included in the public code selection.
create or replace view public.novalife_behavior_strategy_stats
with (security_invoker = true)
as
select
  qs.domain,
  tag as strategy_key,
  count(*)::bigint as signal_count,
  count(*) filter (where qs.rating = 1)::bigint as helpful_count,
  count(*) filter (where qs.rating = -1)::bigint as unhelpful_count,
  round((count(*) filter (where qs.rating = 1) + 3.0) / (count(*) + 6.0), 6) as posterior_helpfulness,
  max(qs.created_at) as last_signal_at
from public.quality_signals qs
cross join lateral unnest(qs.strategy_tags) as tag
where qs.filter_version is not null
group by qs.domain, tag;
