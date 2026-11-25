"use server";

import type { TravelMode } from "@/lib/travel-estimate";
import {
  FAILED,
  FORBIDDEN,
  ISO_DATE,
  isPermissionError,
  signedInClient,
  UUID,
  type ActionResult,
} from "./action-helpers";

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export type ItineraryPatch = {
  day_date?: string;
  position?: number;
  start_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  title?: string | null;
  travel_mode?: TravelMode | null;
};

function cleanPatch(patch: ItineraryPatch): ItineraryPatch | null {
  const clean: ItineraryPatch = {};
  if (patch.day_date !== undefined) {
    if (!ISO_DATE.test(patch.day_date)) return null;
    clean.day_date = patch.day_date;
  }
  if (patch.position !== undefined) {
    if (!Number.isFinite(patch.position)) return null;
    clean.position = patch.position;
  }
  if (patch.start_time !== undefined) {
    if (patch.start_time !== null && !TIME.test(patch.start_time)) return null;
    clean.start_time = patch.start_time;
  }
  if (patch.duration_minutes !== undefined) {
    const minutes = patch.duration_minutes;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440)) return null;
    clean.duration_minutes = minutes;
  }
  if (patch.notes !== undefined) clean.notes = patch.notes?.trim().slice(0, 2000) || null;
  if (patch.title !== undefined) clean.title = patch.title?.trim().slice(0, 200) || null;
  if (patch.travel_mode !== undefined) {
    if (patch.travel_mode !== null && !["driving", "walking", "cycling"].includes(patch.travel_mode)) return null;
    clean.travel_mode = patch.travel_mode;
  }
  return clean;
}

function dayError(error: { code?: string; message: string }): ActionResult | null {
  // Raised by the validate_itinerary_day trigger.
  return error.code === "P0001" && error.message.includes("outside the trip dates")
    ? { ok: false, error: "That day is outside the trip dates." }
    : null;
}

export async function createItineraryItem(input: {
  id: string;
  tripId: string;
  day_date: string;
  position: number;
  placeId: string | null;
  title: string | null;
}): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  const patch = cleanPatch({ day_date: input.day_date, position: input.position, title: input.title });
  if (!patch || !UUID.test(input.id) || !UUID.test(input.tripId)) return FAILED;
  if (input.placeId !== null && !UUID.test(input.placeId)) return FAILED;
  if (!input.placeId && !patch.title) return { ok: false, error: "Give the activity a name." };

  const { error } = await supabase.from("itinerary_items").insert({
    id: input.id,
    trip_id: input.tripId,
    day_date: patch.day_date!,
    position: patch.position!,
    place_id: input.placeId,
    title: patch.title ?? null,
  });
  if (error) {
    if (isPermissionError(error)) return FORBIDDEN;
    console.error("createItineraryItem", error);
    return dayError(error) ?? FAILED;
  }
  return { ok: true };
}

export async function updateItineraryItem(itemId: string, patch: ItineraryPatch): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  const clean = cleanPatch(patch);
  if (!clean || !UUID.test(itemId)) return FAILED;

  const { data, error } = await supabase
    .from("itinerary_items")
    .update(clean)
    .eq("id", itemId)
    .select("id");
  if (error) {
    if (error.message.includes("travel_mode") && clean.travel_mode !== undefined) {
      const { travel_mode: _mode, ...rest } = clean;
      if (Object.keys(rest).length === 0) return { ok: false, error: "TRAVEL_MODE_UNAVAILABLE" };
      const retry = await supabase.from("itinerary_items").update(rest).eq("id", itemId).select("id");
      if (!retry.error) return retry.data.length === 0 ? FORBIDDEN : { ok: false, error: "TRAVEL_MODE_UNAVAILABLE" };
    }
    console.error("updateItineraryItem", error);
    return dayError(error) ?? FAILED;
  }
  return data.length === 0 ? FORBIDDEN : { ok: true };
}

export async function deleteItineraryItem(itemId: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(itemId)) return FAILED;

  const { data, error } = await supabase.from("itinerary_items").delete().eq("id", itemId).select("id");
  if (error) {
    console.error("deleteItineraryItem", error);
    return FAILED;
  }
  return data.length === 0 ? FORBIDDEN : { ok: true };
}
