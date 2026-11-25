-- Storage buckets.
--
-- covers  (public): trips/{trip_id}/<file>   – trip editors write
--                   guides/{guide_id}/<file> – guide author writes
-- journal (private): {trip_id}/<file>        – trip members read, editors write

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('journal', 'journal', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'])
on conflict (id) do nothing;

create or replace function private.can_write_cover(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[] := storage.foldername(object_name);
  target_id uuid;
begin
  if array_length(folders, 1) is distinct from 2 then
    return false;
  end if;

  begin
    target_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if folders[1] = 'trips' then
    return private.can_edit_trip(target_id);
  elsif folders[1] = 'guides' then
    return private.is_guide_author(target_id);
  end if;
  return false;
end;
$$;

create or replace function private.journal_trip_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

grant execute on function private.can_write_cover(text) to authenticated;
grant execute on function private.journal_trip_id(text) to authenticated;

create policy "Editors upload covers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'covers' and private.can_write_cover(name));

create policy "Editors update covers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'covers' and private.can_write_cover(name))
  with check (bucket_id = 'covers' and private.can_write_cover(name));

create policy "Editors delete covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers' and private.can_write_cover(name));

create policy "Members read journal photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'journal' and private.is_trip_member(private.journal_trip_id(name)));

create policy "Editors upload journal photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'journal' and private.can_edit_trip(private.journal_trip_id(name)));

create policy "Editors delete journal photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'journal' and private.can_edit_trip(private.journal_trip_id(name)));
