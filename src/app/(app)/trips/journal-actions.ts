"use server";

import { signJournalPhotos, type JournalPhoto } from "@/lib/data/trip";
import {
  FAILED,
  FORBIDDEN,
  ISO_DATE,
  isPermissionError,
  signedInClient,
  UUID,
  type ActionResult,
} from "./action-helpers";

const MAX_BODY = 10_000;
const MAX_PHOTOS = 12;
const PHOTO_NAME = /^[0-9a-f-]{36}\.(jpe?g|png|webp|avif|heic)$/i;

export type JournalInput = { entry_date: string; body: string; photos: string[] };
export type JournalResult = { ok: true; photos: JournalPhoto[] } | { ok: false; error: string };

function clean(
  tripId: string,
  input: JournalInput,
): { error: string } | { values: { entry_date: string; body: string; photos: string[] } } {
  const body = input.body.trim();
  if (!ISO_DATE.test(input.entry_date)) return { error: "Pick a date." };
  if (body.length > MAX_BODY) return { error: "That entry is too long." };
  if (input.photos.length > MAX_PHOTOS) return { error: `Add up to ${MAX_PHOTOS} photos.` };
  const valid = input.photos.every((path) => {
    const [folder, name, ...rest] = path.split("/");
    return folder === tripId && rest.length === 0 && PHOTO_NAME.test(name ?? "");
  });
  if (!valid) return { error: "One of those photos couldn't be attached." };
  if (!body && input.photos.length === 0) return { error: "Write something or add a photo." };
  return { values: { entry_date: input.entry_date, body, photos: [...new Set(input.photos)] } };
}

async function signed(paths: string[]): Promise<JournalPhoto[]> {
  const urls = await signJournalPhotos(paths);
  return paths.flatMap((path) => {
    const url = urls.get(path);
    return url ? [{ path, url }] : [];
  });
}

export async function createJournalEntry(
  id: string,
  tripId: string,
  input: JournalInput,
): Promise<JournalResult> {
  const { supabase, user } = await signedInClient();
  if (!UUID.test(id) || !UUID.test(tripId)) return FAILED;
  const checked = clean(tripId, input);
  if ("error" in checked) return { ok: false, error: checked.error };

  const { error } = await supabase
    .from("journal_entries")
    .insert({ id, trip_id: tripId, author_id: user.id, ...checked.values });
  if (error) {
    if (isPermissionError(error)) return FORBIDDEN;
    console.error("createJournalEntry", error);
    return FAILED;
  }
  return { ok: true, photos: await signed(checked.values.photos) };
}

export async function updateJournalEntry(id: string, input: JournalInput): Promise<JournalResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(id)) return FAILED;

  const { data: existing } = await supabase
    .from("journal_entries")
    .select("trip_id, photos")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return FORBIDDEN;
  const checked = clean(existing.trip_id, input);
  if ("error" in checked) return { ok: false, error: checked.error };

  const { data, error } = await supabase
    .from("journal_entries")
    .update({ ...checked.values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("updateJournalEntry", error);
    return FAILED;
  }
  if (data.length === 0) return FORBIDDEN;

  const removed = existing.photos.filter((path) => !checked.values.photos.includes(path));
  if (removed.length > 0) {
    const { error: storageError } = await supabase.storage.from("journal").remove(removed);
    if (storageError) console.error("updateJournalEntry: remove photos", storageError);
  }
  return { ok: true, photos: await signed(checked.values.photos) };
}

export async function deleteJournalEntry(id: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(id)) return FAILED;

  const { data, error } = await supabase.from("journal_entries").delete().eq("id", id).select("photos");
  if (error) {
    console.error("deleteJournalEntry", error);
    return FAILED;
  }
  if (data.length === 0) return FORBIDDEN;

  const photos = data[0].photos;
  if (photos.length > 0) {
    const { error: storageError } = await supabase.storage.from("journal").remove(photos);
    if (storageError) console.error("deleteJournalEntry: remove photos", storageError);
  }
  return { ok: true };
}
