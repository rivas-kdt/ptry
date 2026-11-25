-- Row Level Security.
--
-- Trips and their child rows: members read; owners/editors write; viewers read-only.
-- Guides: published guides are public; only the author can see drafts or edit.
-- Destinations and places: public read; writes only via the service role.

-- Helpers live outside the API-exposed `public` schema so they can't be called over RPC.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.trip_member_role(p_trip_id uuid)
returns public.trip_member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = (select auth.uid());
$$;

create or replace function private.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.trip_member_role(p_trip_id) is not null;
$$;

create or replace function private.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.trip_member_role(p_trip_id) in ('owner', 'editor'), false);
$$;

create or replace function private.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.trip_member_role(p_trip_id) = 'owner', false);
$$;

create or replace function private.can_view_guide(p_guide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guides
    where id = p_guide_id
      and (status = 'published' or author_id = (select auth.uid()))
  );
$$;

create or replace function private.is_guide_author(p_guide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guides
    where id = p_guide_id and author_id = (select auth.uid())
  );
$$;

create or replace function private.is_published_guide(p_guide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guides where id = p_guide_id and status = 'published'
  );
$$;

create or replace function private.section_guide_id(p_section_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select guide_id from public.guide_sections where id = p_section_id;
$$;

grant execute on all functions in schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants (RLS still decides which rows are visible)
-- ---------------------------------------------------------------------------

grant select on public.profiles, public.destinations, public.places,
  public.guides, public.guide_sections, public.guide_places, public.guide_likes
  to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.destinations enable row level security;
alter table public.places enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_blocks enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.journal_entries enable row level security;
alter table public.guides enable row level security;
alter table public.guide_sections enable row level security;
alter table public.guide_places enable row level security;
alter table public.guide_likes enable row level security;
alter table public.guide_saves enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create policy "Destinations are publicly readable"
  on public.destinations for select
  to anon, authenticated
  using (true);

create policy "Places are publicly readable"
  on public.places for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------

-- `owner_id` check lets `insert ... returning` see the row before the
-- owner-member trigger has been observed by the policy.
create policy "Members read trips"
  on public.trips for select
  to authenticated
  using (owner_id = (select auth.uid()) or private.is_trip_member(id));

create policy "Users create their own trips"
  on public.trips for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Editors update trips"
  on public.trips for update
  to authenticated
  using (private.can_edit_trip(id))
  with check (private.can_edit_trip(id));

create policy "Owners delete trips"
  on public.trips for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members read trip members"
  on public.trip_members for select
  to authenticated
  using (private.is_trip_member(trip_id));

create policy "Owners add members"
  on public.trip_members for insert
  to authenticated
  with check (private.is_trip_owner(trip_id) and role <> 'owner');

create policy "Owners change member roles"
  on public.trip_members for update
  to authenticated
  using (private.is_trip_owner(trip_id) and role <> 'owner')
  with check (private.is_trip_owner(trip_id) and role <> 'owner');

create policy "Owners remove members and members leave"
  on public.trip_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (private.is_trip_owner(trip_id) or user_id = (select auth.uid()))
  );

-- Trip child tables share the same rules.
do $$
declare
  t text;
begin
  foreach t in array array['trip_blocks', 'itinerary_items', 'budgets', 'expenses']
  loop
    execute format(
      'create policy "Members read %1$s" on public.%1$I for select to authenticated
         using (private.is_trip_member(trip_id))', t);
    execute format(
      'create policy "Editors insert %1$s" on public.%1$I for insert to authenticated
         with check (private.can_edit_trip(trip_id))', t);
    execute format(
      'create policy "Editors update %1$s" on public.%1$I for update to authenticated
         using (private.can_edit_trip(trip_id)) with check (private.can_edit_trip(trip_id))', t);
    execute format(
      'create policy "Editors delete %1$s" on public.%1$I for delete to authenticated
         using (private.can_edit_trip(trip_id))', t);
  end loop;
end;
$$;

create policy "Members read journal entries"
  on public.journal_entries for select
  to authenticated
  using (private.is_trip_member(trip_id));

create policy "Editors write their own journal entries"
  on public.journal_entries for insert
  to authenticated
  with check (private.can_edit_trip(trip_id) and author_id = (select auth.uid()));

create policy "Authors update journal entries"
  on public.journal_entries for update
  to authenticated
  using (author_id = (select auth.uid()) and private.can_edit_trip(trip_id))
  with check (author_id = (select auth.uid()) and private.can_edit_trip(trip_id));

create policy "Authors and owners delete journal entries"
  on public.journal_entries for delete
  to authenticated
  using (
    (author_id = (select auth.uid()) and private.can_edit_trip(trip_id))
    or private.is_trip_owner(trip_id)
  );

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------

create policy "Published guides are public; authors see drafts"
  on public.guides for select
  to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));

create policy "Authors create guides"
  on public.guides for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Authors update guides"
  on public.guides for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors delete guides"
  on public.guides for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Guide sections follow guide visibility"
  on public.guide_sections for select
  to anon, authenticated
  using (private.can_view_guide(guide_id));

create policy "Authors insert guide sections"
  on public.guide_sections for insert
  to authenticated
  with check (private.is_guide_author(guide_id));

create policy "Authors update guide sections"
  on public.guide_sections for update
  to authenticated
  using (private.is_guide_author(guide_id))
  with check (private.is_guide_author(guide_id));

create policy "Authors delete guide sections"
  on public.guide_sections for delete
  to authenticated
  using (private.is_guide_author(guide_id));

create policy "Guide places follow guide visibility"
  on public.guide_places for select
  to anon, authenticated
  using (private.can_view_guide(private.section_guide_id(section_id)));

create policy "Authors insert guide places"
  on public.guide_places for insert
  to authenticated
  with check (private.is_guide_author(private.section_guide_id(section_id)));

create policy "Authors update guide places"
  on public.guide_places for update
  to authenticated
  using (private.is_guide_author(private.section_guide_id(section_id)))
  with check (private.is_guide_author(private.section_guide_id(section_id)));

create policy "Authors delete guide places"
  on public.guide_places for delete
  to authenticated
  using (private.is_guide_author(private.section_guide_id(section_id)));

create policy "Likes on published guides are public"
  on public.guide_likes for select
  to anon, authenticated
  using (private.is_published_guide(guide_id));

create policy "Users like published guides"
  on public.guide_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()) and private.is_published_guide(guide_id));

create policy "Users remove their likes"
  on public.guide_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read their saves"
  on public.guide_saves for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users save visible guides"
  on public.guide_saves for insert
  to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_guide(guide_id));

create policy "Users remove their saves"
  on public.guide_saves for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guide cards (respects the caller's RLS via security_invoker)
-- ---------------------------------------------------------------------------

create view public.guide_cards
with (security_invoker = true)
as
select
  g.id,
  g.title,
  g.intro,
  g.cover_url,
  g.tags,
  g.status,
  g.published_at,
  g.author_id,
  p.username as author_username,
  p.full_name as author_full_name,
  p.avatar_url as author_avatar_url,
  g.destination_id,
  d.name as destination_name,
  d.slug as destination_slug,
  (
    select count(*)::int
    from public.guide_places gp
    join public.guide_sections gs on gs.id = gp.section_id
    where gs.guide_id = g.id
  ) as place_count,
  (
    select count(*)::int from public.guide_likes gl where gl.guide_id = g.id
  ) as like_count
from public.guides g
join public.profiles p on p.id = g.author_id
left join public.destinations d on d.id = g.destination_id;

grant select on public.guide_cards to anon, authenticated;
