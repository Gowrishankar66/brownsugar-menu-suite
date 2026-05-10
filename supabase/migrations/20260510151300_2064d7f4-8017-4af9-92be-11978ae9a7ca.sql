
-- App role enum and user_roles table for admin access
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can view their own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Categories are viewable by everyone"
on public.categories for select
to anon, authenticated
using (true);

create policy "Admins can manage categories"
on public.categories for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Menu items
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  veg_type text not null default 'veg' check (veg_type in ('veg','non-veg')),
  available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.menu_items enable row level security;

create policy "Menu items are viewable by everyone"
on public.menu_items for select
to anon, authenticated
using (true);

create policy "Admins can manage menu items"
on public.menu_items for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Realtime
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.menu_items;

-- Storage bucket for menu images
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true);

create policy "Public can view menu images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'menu-images');

create policy "Admins can upload menu images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'menu-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can update menu images"
on storage.objects for update
to authenticated
using (bucket_id = 'menu-images' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete menu images"
on storage.objects for delete
to authenticated
using (bucket_id = 'menu-images' and public.has_role(auth.uid(), 'admin'));

-- Seed categories
insert into public.categories (name, sort_order) values
  ('Coffee', 1),
  ('Tea', 2),
  ('Momos', 3),
  ('Burgers', 4),
  ('Sandwiches', 5),
  ('Desserts', 6),
  ('Beverages', 7);
