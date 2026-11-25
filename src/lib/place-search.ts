import "server-only";

import {
  searchCatalog,
  searchPlaces,
  type DestinationSearchHit,
  type PlaceSearchHit,
  type PlaceSummary,
} from "@/lib/data/catalog";
import {
  retrieveFeature,
  searchBoxForward,
  searchBoxSuggest,
  type MapboxFeature,
} from "@/lib/mapbox-search";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import type { Enums } from "@/lib/supabase/database.types";

export type { DestinationSearchHit, PlaceSearchHit };

type PlaceCategory = Enums<"place_category">;

const MAPBOX_PREFIX = "mapbox:";

const COUNTRY_ISO: Record<string, string> = {
  philippines: "ph",
  "republic of the philippines": "ph",
  portugal: "pt",
  japan: "jp",
  france: "fr",
  italy: "it",
  spain: "es",
  "united states": "us",
  usa: "us",
  "united kingdom": "gb",
  thailand: "th",
  indonesia: "id",
  vietnam: "vn",
  malaysia: "my",
  singapore: "sg",
  australia: "au",
  "new zealand": "nz",
  mexico: "mx",
  canada: "ca",
  germany: "de",
  greece: "gr",
  morocco: "ma",
  turkey: "tr",
  "south korea": "kr",
  china: "cn",
  india: "in",
  brazil: "br",
  argentina: "ar",
  peru: "pe",
  "south africa": "za",
  egypt: "eg",
  "united arab emirates": "ae",
};

function nameKey(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "place";
}

function isoCountry(country: string | null | undefined) {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toLowerCase();
  return COUNTRY_ISO[trimmed.toLowerCase()];
}

function hasCoords(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function categoryFromPoi(categories: string[]): PlaceCategory {
  const tokens = categories.map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"));
  const has = (...needles: string[]) => tokens.some((token) => needles.some((needle) => token.includes(needle)));
  if (has("fast_food", "fastfood", "burger", "pizza")) return "fast_food";
  if (has("cafe", "coffee", "tea")) return "cafe";
  if (has("restaurant", "food", "dining")) return "restaurant";
  if (has("hotel", "lodging", "hostel", "motel")) return "hotel";
  if (has("nightlife", "nightclub", "bar", "pub", "cocktail")) return "nightlife";
  return "attraction";
}

const PLACE_TYPES = new Set(["poi", "address", "place", "locality", "neighborhood"]);

function featureRank(feature: MapboxFeature) {
  switch (feature.featureType) {
    case "poi":
      return 0;
    case "address":
      return 1;
    case "place":
    case "locality":
    case "neighborhood":
      return 2;
    default:
      return 3;
  }
}

function isUsefulPlace(feature: MapboxFeature) {
  if (feature.mapboxId.length > 256) return false;
  return PLACE_TYPES.has(feature.featureType || "poi");
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesQuery(query: string, name: string) {
  const queryTokens = tokens(query).filter((token) => token.length >= 3);
  if (queryTokens.length === 0) return true;
  const nameTokens = new Set(tokens(name));
  const longest = queryTokens.reduce((current, token) => (token.length > current.length ? token : current));
  return nameTokens.has(longest) || tokens(name).some((token) => token.includes(longest) || longest.includes(token));
}

function nameScore(query: string, name: string) {
  const q = query.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  const queryTokens = tokens(query);
  const nameTokens = tokens(name);
  const overlap = queryTokens.filter((token) => nameTokens.some((part) => part.includes(token))).length;
  return 3 + (queryTokens.length - overlap);
}

function hitFromMapboxPlace(feature: MapboxFeature): PlaceSearchHit {
  return {
    id: `${MAPBOX_PREFIX}${feature.mapboxId}`,
    mapboxId: feature.mapboxId,
    name: feature.name,
    category: categoryFromPoi(feature.poiCategories),
    address: feature.fullAddress ?? feature.address ?? feature.placeFormatted,
    photo_url: null,
    rating: null,
    lat: Number.isFinite(feature.lat) ? feature.lat : 0,
    lng: Number.isFinite(feature.lng) ? feature.lng : 0,
    city: feature.place,
    country: feature.country,
  };
}

export async function searchPlacesLive(
  query: string,
  destinationId: string | null,
  sessionToken: string,
  limit = 8,
): Promise<PlaceSearchHit[]> {
  const catalog = await searchPlaces(query, destinationId, limit).catch((error) => {
    console.error(error);
    return [] as PlaceSummary[];
  });

  if (query.trim().length < 2) return catalog;

  let proximity: { lng: number; lat: number } | undefined;
  let country: string | undefined;
  if (destinationId) {
    const { data } = await createPublicClient()
      .from("destinations")
      .select("lat, lng, country")
      .eq("id", destinationId)
      .maybeSingle();
    if (data) {
      if (hasCoords(data.lat, data.lng)) proximity = { lng: data.lng, lat: data.lat };
      country = isoCountry(data.country);
    }
  }

  let remote: MapboxFeature[] = [];
  try {
    const [suggested, forwarded] = await Promise.all([
      searchBoxSuggest({ query, proximity, country, sessionToken, limit: 10 }),
      searchBoxForward({ query, proximity, country, limit: 5 }),
    ]);
    remote = [...forwarded, ...suggested];
    if (remote.filter(isUsefulPlace).length === 0 && country) {
      const [suggestedOpen, forwardedOpen] = await Promise.all([
        searchBoxSuggest({ query, proximity, sessionToken, limit: 10 }),
        searchBoxForward({ query, proximity, limit: 5 }),
      ]);
      remote = [...forwardedOpen, ...suggestedOpen];
    }
    const seenIds = new Set<string>();
    remote = remote.filter((feature) => {
      if (seenIds.has(feature.mapboxId) || !isUsefulPlace(feature) || !matchesQuery(query, feature.name)) return false;
      seenIds.add(feature.mapboxId);
      return true;
    });
    remote.sort((a, b) => {
      const countryDelta =
        Number(Boolean(country) && b.countryCode === country) - Number(Boolean(country) && a.countryCode === country);
      if (countryDelta) return countryDelta;
      const names = nameScore(query, a.name) - nameScore(query, b.name);
      if (names) return names;
      return featureRank(a) - featureRank(b);
    });
  } catch (error) {
    console.error(error);
  }

  const seen = new Set<string>();
  const extras: PlaceSearchHit[] = [];
  for (const feature of remote) {
    const key = nameKey(feature.name);
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push(hitFromMapboxPlace(feature));
  }

  const catalogExtra = catalog.filter((place) => {
    const key = nameKey(place.name);
    if (seen.has(key)) return false;
    if (
      proximity &&
      hasCoords(place.lat, place.lng) &&
      kmBetween(proximity, { lat: place.lat, lng: place.lng }) > 400
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return [...extras, ...catalogExtra].slice(0, limit);
}

export async function searchDestinationsLive(
  query: string,
  sessionToken: string,
  limit = 6,
): Promise<DestinationSearchHit[]> {
  const catalog = await searchCatalog(query, limit).catch((error) => {
    console.error(error);
    return { destinations: [], guides: [] };
  });
  const local: DestinationSearchHit[] = catalog.destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    country: destination.country,
    region: destination.region,
    lat: 0,
    lng: 0,
  }));

  let remote: MapboxFeature[] = [];
  try {
    remote = await searchBoxSuggest({
      query,
      types: "place,city,locality,region",
      sessionToken,
      limit,
    });
  } catch (error) {
    console.error(error);
  }

  const seen = new Set(local.map((item) => `${nameKey(item.name)}|${nameKey(item.country)}`));
  const extras: DestinationSearchHit[] = [];
  for (const feature of remote) {
    const country = feature.country ?? feature.placeFormatted?.split(",").at(-1)?.trim() ?? "";
    const key = `${nameKey(feature.name)}|${nameKey(country)}`;
    if (seen.has(key) || !country) continue;
    seen.add(key);
    extras.push({
      mapboxId: feature.mapboxId,
      name: feature.name,
      country,
      region: feature.region ?? country,
      lat: feature.lat,
      lng: feature.lng,
    });
  }

  return [...local, ...extras].slice(0, limit);
}

export async function persistMapboxDestination(input: {
  mapboxId: string;
  name: string;
  country: string;
  region?: string;
  lat: number;
  lng: number;
  sessionToken?: string;
}): Promise<Pick<DestinationSearchHit, "id" | "name" | "country">> {
  const details = await retrieveFeature(input.mapboxId, input.sessionToken || crypto.randomUUID()).catch(() => null);
  const name = (details?.name ?? input.name).trim().slice(0, 80);
  const country = (details?.country ?? input.country).trim().slice(0, 80);
  const region = (details?.region ?? input.region ?? country).trim().slice(0, 80) || country;
  const lat = details?.lat ?? input.lat;
  const lng = details?.lng ?? input.lng;
  if (!hasCoords(lat, lng)) {
    throw new Error("That destination is missing a location.");
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("destinations")
    .select("id, name, country")
    .ilike("name", name)
    .ilike("country", country)
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await admin
      .from("destinations")
      .insert({ name, slug, country, region, lat, lng })
      .select("id, name, country")
      .single();
    if (!error && data) return data;
    if (error?.code !== "23505") {
      console.error("persistMapboxDestination", error);
      throw new Error("Couldn't save that destination.");
    }
    slug = `${base}-${input.mapboxId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase() || attempt}`.slice(0, 60);
  }
  throw new Error("Couldn't save that destination.");
}

export async function persistMapboxPlace(
  input: PlaceSearchHit & { destinationId: string | null; sessionToken?: string },
): Promise<PlaceSummary> {
  if (!input.mapboxId) throw new Error("Missing Mapbox place id.");
  const details = await retrieveFeature(input.mapboxId, input.sessionToken || crypto.randomUUID()).catch(() => null);
  const name = (details?.name ?? input.name).trim().slice(0, 120);
  const address = (details?.fullAddress ?? details?.address ?? input.address)?.slice(0, 200) ?? null;
  const lat = details?.lat ?? input.lat;
  const lng = details?.lng ?? input.lng;
  const category = details ? categoryFromPoi(details.poiCategories) : input.category;
  if (!hasCoords(lat, lng)) {
    throw new Error("That place is missing a location.");
  }

  const admin = createAdminClient();
  const externalId = `${MAPBOX_PREFIX}${input.mapboxId}`;

  const { data: existing } = await admin
    .from("places")
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) return existing;

  let destinationId = input.destinationId;
  if (!destinationId) {
    const country = (details?.country ?? input.country?.trim()) || "Unknown";
    const saved = await persistMapboxDestination({
      mapboxId: input.mapboxId,
      name: (details?.place ?? input.city?.trim()) || name,
      country,
      region: (details?.region ?? input.city?.trim()) || country,
      lat,
      lng,
      sessionToken: input.sessionToken,
    });
    destinationId = saved.id!;
  }

  const { data, error } = await admin
    .from("places")
    .insert({
      destination_id: destinationId,
      name,
      category,
      address,
      lat,
      lng,
      external_id: externalId,
    })
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .single();

  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("places")
      .select("id, name, category, address, photo_url, rating, lat, lng")
      .eq("external_id", externalId)
      .maybeSingle();
    if (raced) return raced;
  }
  if (error || !data) {
    console.error("persistMapboxPlace", error);
    throw new Error("Couldn't save that place.");
  }
  return data;
}

export async function persistPinnedPlace(input: {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  destinationId: string;
}): Promise<PlaceSummary> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Give the pin a name.");
  if (!hasCoords(input.lat, input.lng)) throw new Error("That pin is missing a location.");

  const admin = createAdminClient();
  const externalId = `pin:${input.lat.toFixed(5)},${input.lng.toFixed(5)}`;
  const { data: existing } = await admin
    .from("places")
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("places")
    .insert({
      destination_id: input.destinationId,
      name,
      category: "attraction",
      address: input.address?.trim().slice(0, 200) || null,
      lat: input.lat,
      lng: input.lng,
      external_id: externalId,
    })
    .select("id, name, category, address, photo_url, rating, lat, lng")
    .single();

  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("places")
      .select("id, name, category, address, photo_url, rating, lat, lng")
      .eq("external_id", externalId)
      .maybeSingle();
    if (raced) return raced;
  }
  if (error || !data) {
    console.error("persistPinnedPlace", error);
    throw new Error("Couldn't save that pin.");
  }
  return data;
}
