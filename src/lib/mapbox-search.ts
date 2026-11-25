import "server-only";

const SEARCH_BOX = "https://api.mapbox.com/search/searchbox/v1";

export function mapboxToken() {
  return process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

export type MapboxFeature = {
  mapboxId: string;
  name: string;
  featureType: string;
  address: string | null;
  placeFormatted: string | null;
  fullAddress: string | null;
  lat: number;
  lng: number;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  place: string | null;
  poiCategories: string[];
};

type Layer = { name?: string; country_code?: string };
type FeatureProperties = {
  name?: string;
  mapbox_id?: string;
  feature_type?: string;
  address?: string;
  full_address?: string;
  place_formatted?: string;
  poi_category?: string[];
  coordinates?: { latitude?: number; longitude?: number };
  context?: {
    country?: Layer;
    region?: Layer;
    place?: Layer;
  };
};
type ForwardFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: FeatureProperties;
};
type Suggestion = FeatureProperties & {
  name?: string;
  mapbox_id?: string;
  feature_type?: string;
  full_address?: string;
  place_formatted?: string;
  poi_category?: string[];
  context?: FeatureProperties["context"];
};

function parseFeature(
  properties: FeatureProperties,
  geometry?: { coordinates?: [number, number] },
): MapboxFeature | null {
  const lng = properties.coordinates?.longitude ?? geometry?.coordinates?.[0];
  const lat = properties.coordinates?.latitude ?? geometry?.coordinates?.[1];
  const mapboxId = properties.mapbox_id;
  const name = properties.name?.trim();
  if (!mapboxId || !name) return null;
  return {
    mapboxId,
    name,
    featureType: properties.feature_type ?? "",
    address: properties.address?.trim() || null,
    placeFormatted: properties.place_formatted?.trim() || null,
    fullAddress: properties.full_address?.trim() || null,
    lat: lat ?? NaN,
    lng: lng ?? NaN,
    country: properties.context?.country?.name?.trim() || null,
    countryCode: properties.context?.country?.country_code?.trim().toLowerCase() || null,
    region: properties.context?.region?.name?.trim() || null,
    place: properties.context?.place?.name?.trim() || null,
    poiCategories: Array.isArray(properties.poi_category) ? properties.poi_category : [],
  };
}

async function mapboxGet(path: string, params: URLSearchParams) {
  const token = mapboxToken();
  if (!token) throw new Error("Missing Mapbox token");
  params.set("access_token", token);
  params.set("language", "en");
  const response = await fetch(`${SEARCH_BOX}${path}?${params}`, { cache: "no-store" });
  if (!response.ok) {
    console.error("Mapbox Search Box", path, response.status, await response.text().catch(() => ""));
    throw new Error("Mapbox search failed");
  }
  return response.json();
}

function applyCommonParams(
  params: URLSearchParams,
  extras: { types?: string; proximity?: { lng: number; lat: number }; country?: string },
) {
  if (extras.types) params.set("types", extras.types);
  if (extras.country && /^[a-z]{2}(,[a-z]{2})*$/i.test(extras.country)) {
    params.set("country", extras.country.toLowerCase());
  }
  if (extras.proximity) {
    params.set("proximity", `${extras.proximity.lng},${extras.proximity.lat}`);
    params.set("origin", `${extras.proximity.lng},${extras.proximity.lat}`);
  }
}

/** Autocomplete ranking (closer to Google Places than `/forward`). Coordinates come from `/retrieve`. */
export async function searchBoxSuggest({
  query,
  types,
  proximity,
  country,
  sessionToken,
  limit = 8,
}: {
  query: string;
  types?: string;
  proximity?: { lng: number; lat: number };
  country?: string;
  sessionToken: string;
  limit?: number;
}): Promise<MapboxFeature[]> {
  if (query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query.trim().slice(0, 256),
    session_token: sessionToken,
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });
  applyCommonParams(params, { types, proximity, country });

  const body = (await mapboxGet("/suggest", params)) as { suggestions?: Suggestion[] };
  return (body.suggestions ?? []).flatMap((suggestion) => {
    const feature = parseFeature(suggestion);
    return feature ? [feature] : [];
  });
}

/** Exact-query lookup with coordinates. Complements `/suggest` for named places Google would rank first. */
export async function searchBoxForward({
  query,
  types,
  proximity,
  country,
  limit = 5,
}: {
  query: string;
  types?: string;
  proximity?: { lng: number; lat: number };
  country?: string;
  limit?: number;
}): Promise<MapboxFeature[]> {
  if (query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query.trim().slice(0, 256),
    limit: String(Math.min(Math.max(limit, 1), 10)),
    auto_complete: "true",
  });
  applyCommonParams(params, { types, proximity, country });

  const body = (await mapboxGet("/forward", params)) as { features?: ForwardFeature[] };
  return (body.features ?? []).flatMap((feature) => {
    const parsed = parseFeature(feature.properties ?? {}, feature.geometry);
    return parsed ? [parsed] : [];
  });
}

export async function retrieveFeature(mapboxId: string, sessionToken: string): Promise<MapboxFeature | null> {
  const params = new URLSearchParams({ session_token: sessionToken });
  const body = (await mapboxGet(`/retrieve/${encodeURIComponent(mapboxId)}`, params)) as {
    features?: ForwardFeature[];
  };
  const feature = body.features?.[0];
  if (!feature) return null;
  const parsed = parseFeature(feature.properties ?? {}, feature.geometry);
  if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
  return parsed;
}

export async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<{ name: string; address: string | null } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const token = mapboxToken();
  if (!token) return null;
  const params = new URLSearchParams({
    longitude: lng.toFixed(6),
    latitude: lat.toFixed(6),
    access_token: token,
    language: "en",
  });
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`, { cache: "no-store" });
  if (!response.ok) {
    console.error("Mapbox reverse geocode", response.status, await response.text().catch(() => ""));
    return null;
  }
  const body = (await response.json()) as { features?: ForwardFeature[] };
  const features = body.features ?? [];
  const rank = (type: string) => (type === "poi" ? 0 : type === "address" ? 1 : 2);
  features.sort(
    (a, b) => rank(a.properties?.feature_type ?? "") - rank(b.properties?.feature_type ?? ""),
  );
  const top = features[0]?.properties;
  if (!top) return null;
  const name = top.name?.trim();
  if (!name) return null;
  return {
    name,
    address: top.full_address?.trim() || top.place_formatted?.trim() || top.address?.trim() || null,
  };
}
