export type Coord = { lat: number; lng: number };

export type TravelMode = "driving" | "walking" | "cycling";

export type TravelEstimate = {
  minutes: number;
  meters: number;
  approximate: boolean;
};

export const TRAVEL_MODES: { id: TravelMode; label: string; noun: string; speedKmh: number }[] = [
  { id: "driving", label: "Drive", noun: "drive", speedKmh: 25 },
  { id: "walking", label: "Walk", noun: "walk", speedKmh: 5 },
  { id: "cycling", label: "Bike", noun: "bike", speedKmh: 15 },
];

const cache = new Map<string, TravelEstimate>();

function roundPoint(point: Coord): Coord {
  return {
    lat: Math.round(point.lat * 1e5) / 1e5,
    lng: Math.round(point.lng * 1e5) / 1e5,
  };
}

export function travelMode(value: string | null): TravelMode | null {
  return TRAVEL_MODES.some((mode) => mode.id === value) ? (value as TravelMode) : null;
}

export function haversineMeters(from: Coord, to: Coord) {
  const earth = 6371000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(to.lat - from.lat);
  const lng = radians(to.lng - from.lng);
  const a =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Straight-line time at a typical speed for the mode, used when road routing is unavailable. */
export function approximateLeg(from: Coord, to: Coord, mode: TravelMode): TravelEstimate {
  const meters = haversineMeters(from, to);
  const speed = TRAVEL_MODES.find((entry) => entry.id === mode)?.speedKmh ?? 25;
  const minutes = Math.max(1, Math.round((meters / 1000 / speed) * 60));
  return { minutes, meters: Math.round(meters), approximate: true };
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers < 10 ? 1 : 0)} km`;
}

/** One road leg for the chosen mode. Returns null when the router cannot answer. */
export async function fetchTravelLeg(
  from: Coord,
  to: Coord,
  mode: TravelMode,
  token: string,
  signal: AbortSignal,
): Promise<TravelEstimate | null> {
  if (!token) return null;
  const start = roundPoint(from);
  const end = roundPoint(to);
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const cacheKey = `${mode}:${coordinates}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      overview: "false",
      steps: "false",
      access_token: token,
    });
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinates}?${params}`,
      { signal },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: { duration?: number; distance?: number }[];
    };
    const route = body.routes?.[0];
    if (!route || !Number.isFinite(route.duration) || !Number.isFinite(route.distance)) return null;
    const estimate = {
      minutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
      meters: Math.max(0, Math.round(route.distance ?? 0)),
      approximate: false,
    };
    cache.set(cacheKey, estimate);
    return estimate;
  } catch {
    return null;
  }
}

const lineCache = new Map<string, [number, number][]>();

/** Road geometry for one chosen leg. Returns null when the router cannot answer. */
export async function fetchTravelLine(
  from: Coord,
  to: Coord,
  mode: TravelMode,
  token: string,
  signal: AbortSignal,
): Promise<[number, number][] | null> {
  if (!token) return null;
  const start = roundPoint(from);
  const end = roundPoint(to);
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const cacheKey = `${mode}:${coordinates}`;
  const cached = lineCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      geometries: "geojson",
      overview: "full",
      steps: "false",
      access_token: token,
    });
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinates}?${params}`,
      { signal },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const line = body.routes?.[0]?.geometry?.coordinates;
    if (!line || line.length < 2) return null;
    lineCache.set(cacheKey, line);
    return line;
  } catch {
    return null;
  }
}
