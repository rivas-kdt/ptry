alter table public.itinerary_items
  add column if not exists travel_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itinerary_items_travel_mode_check'
  ) then
    alter table public.itinerary_items
      add constraint itinerary_items_travel_mode_check
      check (travel_mode in ('driving', 'walking', 'cycling'));
  end if;
end $$;
