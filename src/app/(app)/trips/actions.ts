"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "@/lib/format";
import { supabaseUrl } from "@/lib/supabase/env";
import { ISO_DATE, signedInClient, UUID, type ActionResult } from "./action-helpers";

export type { ActionResult } from "./action-helpers";
import { DEFAULT_TITLES, type TripRole } from "@/lib/trip-blocks";

export type TripFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "destination_id" | "start_date" | "end_date", string>>;
  saved?: number;
};

const MAX_TRIP_DAYS = 90;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validateTripFields(formData: FormData) {
  const fieldErrors: NonNullable<TripFormState["fieldErrors"]> = {};
  const destinationId = text(formData, "destination_id");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  let name = text(formData, "name");

  if (destinationId && !UUID.test(destinationId)) {
    fieldErrors.destination_id = "Pick a destination from the list.";
  }
  if (!ISO_DATE.test(startDate)) fieldErrors.start_date = "Choose a start date.";
  if (!ISO_DATE.test(endDate)) fieldErrors.end_date = "Choose an end date.";
  if (!fieldErrors.start_date && !fieldErrors.end_date) {
    const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
    if (Number.isNaN(days)) fieldErrors.start_date = "Choose valid dates.";
    else if (days < 0) fieldErrors.end_date = "The trip can't end before it starts.";
    else if (days >= MAX_TRIP_DAYS) fieldErrors.end_date = `Trips can be at most ${MAX_TRIP_DAYS} days.`;
  }
  if (!name) {
    const destinationName = text(formData, "destination_name");
    name = destinationName ? `Trip to ${destinationName}` : "";
  }
  if (!name) fieldErrors.name = "Give your trip a name.";
  else if (name.length > 120) fieldErrors.name = "Keep the name under 120 characters.";

  return {
    fieldErrors,
    values: {
      name,
      destination_id: destinationId || null,
      start_date: startDate,
      end_date: endDate,
    },
  };
}

export async function createTrip(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const { supabase } = await signedInClient();
  const { fieldErrors, values } = validateTripFields(formData);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { data, error } = await supabase.from("trips").insert(values).select("id").single();
  if (error) {
    console.error("createTrip", error);
    return { error: "Couldn't create the trip. Try again." };
  }

  // Wanderlog-style starter blocks; the trip is still usable if this fails.
  const { error: blocksError } = await supabase.from("trip_blocks").insert([
    { trip_id: data.id, type: "note", title: DEFAULT_TITLES.note, position: 1, content: { text: "" } },
    { trip_id: data.id, type: "reservation", title: DEFAULT_TITLES.reservation, position: 2, content: { kind: "flight" } },
    { trip_id: data.id, type: "list", title: "Places to visit", position: 3, content: { items: [] } },
  ]);
  if (blocksError) console.error("createTrip starter blocks", blocksError);

  redirect(`/trips/${data.id}`);
}

export async function updateTrip(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const { supabase } = await signedInClient();
  const tripId = text(formData, "trip_id");
  if (!UUID.test(tripId)) return { error: "Unknown trip." };

  const { fieldErrors, values } = validateTripFields(formData);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const coverUrl = text(formData, "cover_url");
  const coverPrefix = `${supabaseUrl()}/storage/v1/object/public/covers/trips/${tripId}/`;
  if (coverUrl && !coverUrl.startsWith(coverPrefix)) {
    return { error: "That cover photo can't be used." };
  }

  const { data: before } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("trips")
    .update({ ...values, cover_url: coverUrl || null })
    .eq("id", tripId)
    .select("id");
  if (error) {
    console.error("updateTrip", error);
    return { error: "Couldn't save the trip. Try again." };
  }
  if (data.length === 0) return { error: "You don't have permission to edit this trip." };

  if (before && (before.start_date !== values.start_date || before.end_date !== values.end_date)) {
    await moveItineraryIntoRange(supabase, tripId, before.start_date, values);
  }

  refresh();
  return { saved: Date.now() };
}

/** Shifts itinerary days with the new start date and clamps anything left outside the range. */
async function moveItineraryIntoRange(
  supabase: Awaited<ReturnType<typeof signedInClient>>["supabase"],
  tripId: string,
  previousStart: string,
  range: { start_date: string; end_date: string },
) {
  const { data: items, error } = await supabase
    .from("itinerary_items")
    .select("id, day_date")
    .eq("trip_id", tripId);
  if (error || !items) {
    if (error) console.error("moveItineraryIntoRange", error);
    return;
  }

  const shift = Math.round((Date.parse(range.start_date) - Date.parse(previousStart)) / 86_400_000);
  const moves = items.flatMap((item) => {
    let day = addDays(item.day_date, shift);
    if (day < range.start_date) day = range.start_date;
    if (day > range.end_date) day = range.end_date;
    return day === item.day_date ? [] : [{ id: item.id, day }];
  });

  const results = await Promise.all(
    moves.map(({ id, day }) =>
      supabase.from("itinerary_items").update({ day_date: day }).eq("id", id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed) console.error("moveItineraryIntoRange", failed.error);
}

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.from("trips").delete().eq("id", tripId).select("id");
  if (error) {
    console.error("deleteTrip", error);
    return { ok: false, error: "Couldn't delete the trip. Try again." };
  }
  if (data.length === 0) return { ok: false, error: "Only the trip owner can delete it." };
  redirect("/home");
}

const INVITABLE_ROLES: TripRole[] = ["editor", "viewer"];

export async function addTripMember(
  tripId: string,
  username: string,
  role: TripRole,
): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!INVITABLE_ROLES.includes(role)) return { ok: false, error: "Pick editor or viewer." };

  const handle = username.trim().replace(/^@/, "").toLowerCase();
  if (!handle) return { ok: false, error: "Enter a username." };

  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", handle)
    .maybeSingle();
  if (lookupError) return { ok: false, error: "Couldn't look up that user. Try again." };
  if (!profile) return { ok: false, error: `No one is using the username @${handle}.` };

  const { error } = await supabase
    .from("trip_members")
    .insert({ trip_id: tripId, user_id: profile.id, role });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `@${handle} is already on this trip.` };
    if (error.code === "42501") return { ok: false, error: "Only the trip owner can add people." };
    console.error("addTripMember", error);
    return { ok: false, error: "Couldn't add them. Try again." };
  }

  refresh();
  return { ok: true };
}

export async function updateTripMemberRole(
  tripId: string,
  userId: string,
  role: TripRole,
): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!INVITABLE_ROLES.includes(role)) return { ok: false, error: "Pick editor or viewer." };

  const { data, error } = await supabase
    .from("trip_members")
    .update({ role })
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || data.length === 0) {
    if (error) console.error("updateTripMemberRole", error);
    return { ok: false, error: "Only the trip owner can change roles." };
  }

  refresh();
  return { ok: true };
}

export async function removeTripMember(tripId: string, userId: string): Promise<ActionResult> {
  const { user, supabase } = await signedInClient();
  const { data, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error || data.length === 0) {
    if (error) console.error("removeTripMember", error);
    return { ok: false, error: "You can't remove that person." };
  }

  if (userId === user.id) redirect("/home");
  refresh();
  return { ok: true };
}
