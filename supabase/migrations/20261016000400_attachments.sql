-- Reservation attachments (tickets, booking confirmations).
--
-- attachments (private): {trip_id}/{block_id}/<file> – trip members read, editors write

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "Members read attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and private.is_trip_member(private.journal_trip_id(name)));

create policy "Editors upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments' and private.can_edit_trip(private.journal_trip_id(name)));

create policy "Editors delete attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and private.can_edit_trip(private.journal_trip_id(name)));
