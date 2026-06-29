
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  type text not null check (type in (
    'bogo','b2g1','combo','flat_discount','percent_discount',
    'free_dessert','free_beverage','festival','happy_hour','weekend','custom'
  )),
  eligible_item_ids uuid[] not null default '{}',
  eligible_category_ids uuid[] not null default '{}',
  reward_item_ids uuid[] not null default '{}',
  reward_category_ids uuid[] not null default '{}',
  discount_value numeric not null default 0,
  min_subtotal numeric not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  active boolean not null default true,
  max_usage integer,
  usage_count integer not null default 0,
  views_count integer not null default 0,
  revenue_generated numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;

alter table public.promotions enable row level security;

drop policy if exists "Promotions viewable by everyone" on public.promotions;
create policy "Promotions viewable by everyone"
  on public.promotions for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage promotions" on public.promotions;
create policy "Admins manage promotions"
  on public.promotions for all
  to authenticated
  using (has_role(auth.uid(),'admin'))
  with check (has_role(auth.uid(),'admin'));

create or replace function public.touch_promotion_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists promotions_touch on public.promotions;
create trigger promotions_touch before update on public.promotions
for each row execute function public.touch_promotion_updated_at();

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  revenue_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.promotion_redemptions to anon, authenticated;
grant insert on public.promotion_redemptions to anon, authenticated;
grant all on public.promotion_redemptions to service_role;

alter table public.promotion_redemptions enable row level security;

drop policy if exists "Redemptions viewable" on public.promotion_redemptions;
create policy "Redemptions viewable"
  on public.promotion_redemptions for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone insert redemption" on public.promotion_redemptions;
create policy "Anyone insert redemption"
  on public.promotion_redemptions for insert
  to anon, authenticated
  with check (revenue_amount >= 0);

create or replace function public.increment_promotion_views(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promotions set views_count = views_count + 1 where id = p_id;
$$;

revoke execute on function public.increment_promotion_views(uuid) from public;
grant execute on function public.increment_promotion_views(uuid) to anon, authenticated;

create or replace function public.record_promotion_redemption(p_id uuid, p_order uuid, p_revenue numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.promotion_redemptions (promotion_id, order_id, revenue_amount)
  values (p_id, p_order, coalesce(p_revenue, 0));
  update public.promotions
    set usage_count = usage_count + 1,
        revenue_generated = revenue_generated + coalesce(p_revenue, 0)
    where id = p_id;
end;
$$;

revoke execute on function public.record_promotion_redemption(uuid, uuid, numeric) from public;
grant execute on function public.record_promotion_redemption(uuid, uuid, numeric) to anon, authenticated;

alter publication supabase_realtime add table public.promotions;
