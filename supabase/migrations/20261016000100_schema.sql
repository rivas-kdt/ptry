-- Core schema: profiles, destinations, places, trips (+ child tables), guides.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.place_category as enum (
  'attraction',
  'restaurant',
  'fast_food',
  'cafe',
  'hotel',
  'nightlife'
);

create type public.trip_visibility as enum ('private', 'shared');

create type public.trip_member_role as enum ('owner', 'editor', 'viewer');

create type public.trip_block_type as enum ('note', 'list', 'reservation');

create type public.expense_category as enum (
  'flights',
  'lodging',
  'transport',
  'food',
  'activities',
  'shopping',
  'other'
);

create type public.guide_status as enum ('draft', 'published');

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,32}$'),
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates a profile for every new auth user (email sign-up and OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(
    regexp_replace(
      coalesce(
        new.raw_user_meta_data ->> 'username',
        split_part(new.email, '@', 1),
        'traveler'
      ),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );
  base_username := left(base_username, 24);
  if char_length(base_username) < 3 then
    base_username := 'traveler';
  end if;

  final_username := base_username;
  if exists (select 1 from public.profiles where username = final_username) then
    final_username := base_username || '_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Destinations & places (public catalog)
-- ---------------------------------------------------------------------------

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  country text not null,
  region text not null,
  cover_url text,
  description text,
  lat double precision not null,
  lng double precision not null,
  popularity integer not null default 0,
  created_at timestamptz not null default now()
);

create index destinations_popularity_idx on public.destinations (popularity desc);
create index destinations_region_idx on public.destinations (region);
create index destinations_name_trgm_idx
  on public.destinations using gin (name extensions.gin_trgm_ops);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete cascade,
  name text not null,
  category public.place_category not null,
  description text,
  address text,
  lat double precision not null,
  lng double precision not null,
  photo_url text,
  rating numeric(2, 1) check (rating between 0 and 5),
  external_id text unique,
  created_at timestamptz not null default now()
);

create index places_destination_category_idx
  on public.places (destination_id, category, rating desc nulls last);
create index places_name_trgm_idx
  on public.places using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  destination_id uuid references public.destinations (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null,
  cover_url text,
  visibility public.trip_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_range_check
    check (end_date >= start_date and end_date - start_date <= 90)
);

create index trips_owner_idx on public.trips (owner_id);
create index trips_destination_idx on public.trips (destination_id);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create or replace function public.prevent_trip_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Trip owner cannot be changed';
  end if;
  return new;
end;
$$;

create trigger trips_prevent_owner_change
  before update on public.trips
  for each row execute function public.prevent_trip_owner_change();

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.trip_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- The creator of a trip is always its owner member.
create or replace function public.add_trip_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger trips_add_owner_member
  after insert on public.trips
  for each row execute function public.add_trip_owner_member();

-- Overview blocks. `content` shape depends on `type`:
--   note:        { "text": string }
--   list:        { "items": [{ "id", "kind": "check" | "place", "text"?, "place_id"?, "checked"? }] }
--   reservation: { "kind": "flight" | "lodging" | "car" | "other", "confirmation"?, "starts_at"?,
--                  "ends_at"?, "details"?, "attachment_path"? }
create table public.trip_blocks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type public.trip_block_type not null,
  title text,
  position double precision not null,
  collapsed boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_blocks_trip_position_idx on public.trip_blocks (trip_id, position);

create trigger trip_blocks_set_updated_at
  before update on public.trip_blocks
  for each row execute function public.set_updated_at();

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date not null,
  place_id uuid references public.places (id) on delete cascade,
  title text,
  position double precision not null,
  start_time time,
  duration_minutes integer check (duration_minutes > 0 and duration_minutes <= 1440),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itinerary_items_subject_check check (place_id is not null or title is not null)
);

create index itinerary_items_trip_day_idx
  on public.itinerary_items (trip_id, day_date, position);

create trigger itinerary_items_set_updated_at
  before update on public.itinerary_items
  for each row execute function public.set_updated_at();

create or replace function public.validate_itinerary_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  trip_start date;
  trip_end date;
begin
  select start_date, end_date into trip_start, trip_end
  from public.trips where id = new.trip_id;

  if new.day_date < trip_start or new.day_date > trip_end then
    raise exception 'Itinerary day % is outside the trip dates', new.day_date;
  end if;
  return new;
end;
$$;

create trigger itinerary_items_validate_day
  before insert or update of day_date, trip_id on public.itinerary_items
  for each row execute function public.validate_itinerary_day();

create table public.budgets (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  total numeric(12, 2) not null check (total >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  category public.expense_category not null default 'other',
  date date not null default current_date,
  paid_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index expenses_trip_date_idx on public.expenses (trip_id, date desc);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  entry_date date not null default current_date,
  body text not null default '',
  -- Storage object paths in the `journal` bucket.
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_entries_trip_date_idx on public.journal_entries (trip_id, entry_date desc);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  destination_id uuid references public.destinations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  intro text,
  cover_url text,
  tags text[] not null default '{}',
  status public.guide_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guides_author_idx on public.guides (author_id);
create index guides_destination_idx on public.guides (destination_id);
create index guides_published_idx on public.guides (published_at desc) where status = 'published';
create index guides_title_trgm_idx on public.guides using gin (title extensions.gin_trgm_ops);

create trigger guides_set_updated_at
  before update on public.guides
  for each row execute function public.set_updated_at();

create or replace function public.set_guide_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

create trigger guides_set_published_at
  before insert or update of status on public.guides
  for each row execute function public.set_guide_published_at();

create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  title text not null,
  position double precision not null,
  created_at timestamptz not null default now()
);

create index guide_sections_guide_position_idx on public.guide_sections (guide_id, position);

create table public.guide_places (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.guide_sections (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position double precision not null,
  note text,
  created_at timestamptz not null default now()
);

create index guide_places_section_position_idx on public.guide_places (section_id, position);
create index guide_places_place_idx on public.guide_places (place_id);

create table public.guide_likes (
  guide_id uuid not null references public.guides (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guide_id, user_id)
);

create index guide_likes_user_idx on public.guide_likes (user_id);

create table public.guide_saves (
  guide_id uuid not null references public.guides (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guide_id, user_id)
);

create index guide_saves_user_idx on public.guide_saves (user_id);
