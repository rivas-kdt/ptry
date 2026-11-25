import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { getPlacesByIds, type PlaceSummary } from "@/lib/data/catalog";
import type { Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { parseBlockContent, type TripBlock, type TripRole } from "@/lib/trip-blocks";
import { travelMode } from "@/lib/travel-estimate";

export type TripMember = {
  user_id: string;
  role: TripRole;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type TripDetails = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  owner_id: string;
  destination: {
    id: string;
    name: string;
    slug: string;
    country: string;
    cover_url: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  members: TripMember[];
  /** The current user's role, or null if they can see the trip without being a member. */
  role: TripRole | null;
  viewerId: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_ORDER: Record<TripRole, number> = { owner: 0, editor: 1, viewer: 2 };

/** The trip with its destination and members. 404s if missing or not visible to the user. */
export const getTrip = cache(async (tripId: string): Promise<TripDetails> => {
  const user = await requireUser(`/trips/${tripId}`);
  if (!UUID.test(tripId)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select(
      `id, name, start_date, end_date, cover_url, owner_id,
       destination:destinations(id, name, slug, country, cover_url, lat, lng),
       trip_members(user_id, role, profile:profiles(username, full_name, avatar_url))`,
    )
    .eq("id", tripId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load trip: ${error.message}`);
  if (!data) notFound();

  const members = data.trip_members
    .flatMap((member): TripMember[] =>
      member.profile
        ? [
            {
              user_id: member.user_id,
              role: member.role,
              username: member.profile.username,
              full_name: member.profile.full_name,
              avatar_url: member.profile.avatar_url,
            },
          ]
        : [],
    )
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return {
    id: data.id,
    name: data.name,
    start_date: data.start_date,
    end_date: data.end_date,
    cover_url: data.cover_url,
    owner_id: data.owner_id,
    destination: data.destination,
    members,
    role: members.find((member) => member.user_id === user.id)?.role ?? null,
    viewerId: user.id,
  };
});

export type ItineraryPlace = {
  id: string;
  name: string;
  category: Enums<"place_category">;
  address: string | null;
  lat: number;
  lng: number;
  photo_url: string | null;
};

export type ItineraryItem = {
  id: string;
  day_date: string;
  position: number;
  title: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  travel_mode: "driving" | "walking" | "cycling" | null;
  place: ItineraryPlace | null;
};

const ITINERARY_COLUMNS =
  "id, day_date, position, title, start_time, duration_minutes, notes, travel_mode, place:places(id, name, category, address, lat, lng, photo_url)";
const ITINERARY_COLUMNS_WITHOUT_MODE =
  "id, day_date, position, title, start_time, duration_minutes, notes, place:places(id, name, category, address, lat, lng, photo_url)";

export async function getItinerary(tripId: string): Promise<ItineraryItem[]> {
  const supabase = await createClient();
  const primary = await supabase
    .from("itinerary_items")
    .select(ITINERARY_COLUMNS)
    .eq("trip_id", tripId)
    .order("day_date")
    .order("position");

  if (!primary.error) {
    return primary.data.map((item) => ({ ...item, travel_mode: travelMode(item.travel_mode) }));
  }
  if (!primary.error.message.includes("travel_mode")) {
    throw new Error(`Failed to load itinerary: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("itinerary_items")
    .select(ITINERARY_COLUMNS_WITHOUT_MODE)
    .eq("trip_id", tripId)
    .order("day_date")
    .order("position");
  if (fallback.error) throw new Error(`Failed to load itinerary: ${fallback.error.message}`);
  return fallback.data.map((item) => ({ ...item, travel_mode: null }));
}

export type Budget = { total: number; currency: string };

export type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: Enums<"expense_category">;
  date: string;
  paid_by: string | null;
  note: string | null;
};

export async function getBudgetAndExpenses(
  tripId: string,
): Promise<{ budget: Budget | null; expenses: Expense[] }> {
  const supabase = await createClient();
  const [budget, expenses] = await Promise.all([
    supabase.from("budgets").select("total, currency").eq("trip_id", tripId).maybeSingle(),
    supabase
      .from("expenses")
      .select("id, amount, currency, category, date, paid_by, note")
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (budget.error) throw new Error(`Failed to load budget: ${budget.error.message}`);
  if (expenses.error) throw new Error(`Failed to load expenses: ${expenses.error.message}`);
  return {
    budget: budget.data ? { total: Number(budget.data.total), currency: budget.data.currency } : null,
    expenses: expenses.data.map((expense) => ({ ...expense, amount: Number(expense.amount) })),
  };
}

export type JournalPhoto = { path: string; url: string };

export type JournalEntry = {
  id: string;
  entry_date: string;
  body: string;
  created_at: string;
  author: { id: string; username: string; full_name: string | null; avatar_url: string | null } | null;
  photos: JournalPhoto[];
};

const PHOTO_URL_TTL_SECONDS = 60 * 60;

/** Signed URLs for private journal photos, keyed by storage path. */
export async function signJournalPhotos(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("journal")
    .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  if (error) throw new Error(`Failed to sign journal photos: ${error.message}`);
  return new Map(
    data.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])),
  );
}

export async function getJournal(tripId: string): Promise<JournalEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, body, photos, created_at, author_id, author:profiles(username, full_name, avatar_url)",
    )
    .eq("trip_id", tripId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load journal: ${error.message}`);

  const urls = await signJournalPhotos(data.flatMap((entry) => entry.photos));
  return data.map((entry) => ({
    id: entry.id,
    entry_date: entry.entry_date,
    body: entry.body,
    created_at: entry.created_at,
    author: entry.author ? { id: entry.author_id, ...entry.author } : null,
    photos: entry.photos.flatMap((path) => {
      const url = urls.get(path);
      return url ? [{ path, url }] : [];
    }),
  }));
}

export async function getTripBlocks(tripId: string): Promise<TripBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_blocks")
    .select("id, type, title, position, collapsed, content")
    .eq("trip_id", tripId)
    .order("position");

  if (error) throw new Error(`Failed to load trip blocks: ${error.message}`);
  return data.map(
    (row) =>
      ({
        id: row.id,
        type: row.type,
        title: row.title,
        position: row.position,
        collapsed: row.collapsed,
        content: parseBlockContent(row.type, row.content),
      }) as TripBlock,
  );
}

/** Places saved on Overview lists, in list order, for adding to the itinerary. */
export async function getOverviewListPlaces(tripId: string): Promise<PlaceSummary[]> {
  const blocks = await getTripBlocks(tripId);
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type !== "list") continue;
    for (const item of block.content.items) {
      if (item.kind === "place" && item.place_id) ids.push(item.place_id);
    }
  }
  return getPlacesByIds(ids);
}
