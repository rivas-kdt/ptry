import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { Tables, Views } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type DestinationSummary = Pick<
  Tables<"destinations">,
  "id" | "name" | "slug" | "country" | "region" | "cover_url"
>;

export type GuideSummary = Pick<
  Views<"guide_cards">,
  | "id"
  | "title"
  | "intro"
  | "cover_url"
  | "author_username"
  | "author_full_name"
  | "author_avatar_url"
  | "destination_name"
  | "place_count"
  | "like_count"
>;

const DESTINATION_COLUMNS = "id, name, slug, country, region, cover_url";
const GUIDE_COLUMNS =
  "id, title, intro, cover_url, author_username, author_full_name, author_avatar_url, destination_name, place_count, like_count";

export async function getPopularDestinations(limit = 10): Promise<DestinationSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations");

  const { data, error } = await createPublicClient()
    .from("destinations")
    .select(DESTINATION_COLUMNS)
    .order("popularity", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load destinations: ${error.message}`);
  return data;
}

export async function getFeaturedGuides(limit = 8): Promise<GuideSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guides");

  const { data, error } = await createPublicClient()
    .from("guide_cards")
    .select(GUIDE_COLUMNS)
    .eq("status", "published")
    .order("like_count", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load guides: ${error.message}`);
  return data;
}

/** Strips characters that have meaning in PostgREST filter strings. */
function toSearchTerm(query: string) {
  return query.replace(/[%_,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export type CatalogSearchResult = {
  destinations: DestinationSummary[];
  guides: GuideSummary[];
};

export async function searchCatalog(query: string, limit = 6): Promise<CatalogSearchResult> {
  "use cache";
  cacheLife("hours");
  cacheTag("destinations", "guides");

  const term = toSearchTerm(query);
  if (term.length < 2) {
    return { destinations: [], guides: [] };
  }

  const supabase = createPublicClient();
  const pattern = `"%${term}%"`;
  const [destinations, guides] = await Promise.all([
    supabase
      .from("destinations")
      .select(DESTINATION_COLUMNS)
      .or(`name.ilike.${pattern},country.ilike.${pattern},region.ilike.${pattern}`)
      .order("popularity", { ascending: false })
      .limit(limit),
    supabase
      .from("guide_cards")
      .select(GUIDE_COLUMNS)
      .eq("status", "published")
      .or(`title.ilike.${pattern},destination_name.ilike.${pattern}`)
      .order("like_count", { ascending: false })
      .limit(limit),
  ]);

  if (destinations.error) throw new Error(`Search failed: ${destinations.error.message}`);
  if (guides.error) throw new Error(`Search failed: ${guides.error.message}`);

  return { destinations: destinations.data, guides: guides.data };
}

export type PlaceSummary = Pick<
  Tables<"places">,
  "id" | "name" | "category" | "address" | "photo_url" | "rating" | "lat" | "lng"
>;

export type PlaceDetail = PlaceSummary & Pick<Tables<"places">, "description">;

/** Catalog row, or a Mapbox Search hit that still needs to be saved (`mapboxId` set). */
export type PlaceSearchHit = PlaceSummary & {
  mapboxId?: string;
  city?: string | null;
  country?: string | null;
};

export type DestinationSearchHit = {
  id?: string;
  mapboxId?: string;
  name: string;
  country: string;
  region?: string;
  lat: number;
  lng: number;
};

/** Places by name, optionally limited to one destination. */
export async function searchPlaces(
  query: string,
  destinationId: string | null,
  limit = 8,
): Promise<PlaceSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("places");

  const term = toSearchTerm(query);
  let request = createPublicClient()
    .from("places")
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (destinationId) request = request.eq("destination_id", destinationId);
  if (term) request = request.ilike("name", `%${term}%`);

  const { data, error } = await request;
  if (error) throw new Error(`Place search failed: ${error.message}`);
  return data;
}

export async function getPlacesByIds(ids: string[]): Promise<PlaceSummary[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const { data, error } = await createPublicClient()
    .from("places")
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .in("id", unique);
  if (error) throw new Error(`Failed to load places: ${error.message}`);

  const byId = new Map(data.map((place) => [place.id, place]));
  return unique.flatMap((id) => {
    const place = byId.get(id);
    return place ? [place] : [];
  });
}

const PLACE_DETAIL_COLUMNS = "id, name, category, address, photo_url, rating, lat, lng, description";

export async function getPlaceDetails(ids: string[]): Promise<PlaceDetail[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data, error } = await createPublicClient().from("places").select(PLACE_DETAIL_COLUMNS).in("id", unique);
  if (error) throw new Error(`Failed to load places: ${error.message}`);
  const byId = new Map(data.map((place) => [place.id, place]));
  return unique.flatMap((id) => {
    const place = byId.get(id);
    return place ? [place] : [];
  });
}

export async function getDestinationPlaces(destinationId: string, limit = 48): Promise<PlaceSummary[]> {
  const { data, error } = await createPublicClient()
    .from("places")
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .eq("destination_id", destinationId)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load places: ${error.message}`);
  return data;
}
