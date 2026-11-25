"use client";

import { ExternalLink, MapPinned } from "lucide-react";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTravelLine, type TravelMode } from "@/lib/travel-estimate";

export type MapStop = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** How to travel from this stop to the next one. No line is drawn when this is empty. */
  departMode?: TravelMode | null;
};

export type MapDayRoute = {
  id: string;
  label: string;
  color: string;
  stops: MapStop[];
};

export const DAY_ROUTE_COLORS = [
  "#ea580c",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
] as const;

export function dayRouteColor(index: number) {
  return DAY_ROUTE_COLORS[index % DAY_ROUTE_COLORS.length]!;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const FALLBACK_COLOR = DAY_ROUTE_COLORS[0];

export type MapPlaceLabel = { name: string; lat: number; lng: number };
export type MapPreviewPlace = { label: string; lat: number; lng: number };

function isPoiLabelLayer(id: string) {
  return /^(poi-label|transit-label|airport-label|natural-point-label)/.test(id);
}

function poiLabelLayerIds(map: MapboxMap) {
  return (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.type === "symbol" && isPoiLabelLayer(layer.id))
    .map((layer) => layer.id);
}

function featurePlaceName(properties: Record<string, unknown> | null | undefined): string | null {
  if (!properties) return null;
  for (const key of ["name_en", "name", "name_int"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function featurePoint(geometry: { type: string; coordinates: unknown } | null): { lat: number; lng: number } | null {
  if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  const [lng, lat] = geometry.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function namedPoiAt(map: MapboxMap, point: { x: number; y: number }): MapPlaceLabel | null {
  const layers = poiLabelLayerIds(map);
  if (layers.length === 0) return null;
  const box: [[number, number], [number, number]] = [
    [point.x - 12, point.y - 12],
    [point.x + 12, point.y + 12],
  ];
  const features = map.queryRenderedFeatures(box, { layers });
  for (const feature of features) {
    const record = feature as {
      properties?: Record<string, unknown> | null;
      geometry?: { type: string; coordinates: unknown } | null;
    };
    const name = featurePlaceName(record.properties);
    const coords = featurePoint(record.geometry ?? null);
    if (name && coords) return { name, ...coords };
  }
  return null;
}

export function DayMap({
  stops,
  routes,
  selectedRouteId = null,
  center,
  focus = null,
  title,
  pinMode = false,
  pendingPin = null,
  previewPlace = null,
  onPin,
  onPlaceLabel,
  onPreviewClick,
  compact = false,
}: {
  stops?: MapStop[];
  routes?: MapDayRoute[];
  selectedRouteId?: string | null;
  center: { lat: number; lng: number } | null;
  focus?: { lat: number; lng: number; nonce: number } | null;
  title: string;
  pinMode?: boolean;
  pendingPin?: { lat: number; lng: number } | null;
  previewPlace?: MapPreviewPlace | null;
  onPin?: (coords: { lat: number; lng: number }) => void;
  onPlaceLabel?: (place: MapPlaceLabel) => void;
  onPreviewClick?: () => void;
  compact?: boolean;
}) {
  const dayRoutes = useMemo(() => resolveRoutes(routes, stops), [routes, stops]);
  const allStops = useMemo(() => dayRoutes.flatMap((route) => validStops(route.stops)), [dayRoutes]);
  const selectedRoute = dayRoutes.find((route) => route.id === selectedRouteId) ?? dayRoutes.find((route) => route.stops.length >= 2);
  const directionsStops = selectedRoute ? validStops(selectedRoute.stops) : [];

  return (
    <div className="flex flex-col gap-2">
      {compact ? null : (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {directionsStops.length >= 2 && !pinMode ? (
            <a
              href={directionsUrl(directionsStops)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Directions
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </div>
      )}
      <div
        className={
          compact
            ? "relative aspect-video min-h-[180px] overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
            : "relative aspect-[4/3] min-h-[240px] overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10 lg:aspect-[4/5]"
        }
      >
        {MAPBOX_TOKEN ? (
          <MapboxDayMap
            token={MAPBOX_TOKEN}
            routes={dayRoutes}
            selectedRouteId={selectedRouteId}
            center={center}
            focus={focus}
            pinMode={pinMode}
            pendingPin={pendingPin}
            previewPlace={previewPlace}
            onPin={onPin}
            onPlaceLabel={onPlaceLabel}
            onPreviewClick={onPreviewClick}
          />
        ) : (
          <RouteSketch routes={dayRoutes} />
        )}
        {pinMode ? (
          <div className="pointer-events-none absolute top-2 left-2 z-10 max-w-[70%] rounded-lg bg-background/95 px-2 py-1.5 text-xs font-medium shadow-sm ring-1 ring-foreground/10">
            {pendingPin
              ? compact
                ? "Drag the pin to adjust"
                : "Pin dropped — name it in Add place"
              : onPlaceLabel
                ? "Click a place name to add it, or the map to drop a pin"
                : "Click the map to drop a pin"}
          </div>
        ) : null}
        {allStops.length === 0 && !pinMode ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <MapPinned className="size-6" aria-hidden />
            Add places to your itinerary to see them on the map.
          </div>
        ) : null}
      </div>
      {compact ? null : <RouteLegend routes={dayRoutes} selectedRouteId={selectedRouteId} />}
      {!MAPBOX_TOKEN ? (
        <p className="text-xs text-muted-foreground">
          Route sketch. Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> for an
          interactive map.
        </p>
      ) : null}
    </div>
  );
}

function RouteLegend({
  routes,
  selectedRouteId,
}: {
  routes: MapDayRoute[];
  selectedRouteId: string | null;
}) {
  const visible = routes.filter((route) => validStops(route.stops).length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {visible.map((route) => {
        const stops = validStops(route.stops);
        const selected = route.id === selectedRouteId;
        return (
          <div key={route.id} className="flex flex-col gap-1">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: route.color }} aria-hidden />
              <span className={selected ? "text-foreground" : "text-muted-foreground"}>{route.label}</span>
            </p>
            <ol className="flex flex-col gap-0.5 text-sm">
              {stops.map((stop, index) => (
                <li key={stop.id} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold" style={{ color: route.color }}>
                    {index + 1}
                  </span>
                  <span className="truncate">{stop.label}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

type LngLat = [number, number];

type RouteFeature = {
  type: "Feature";
  properties: { color: string; dayId: string; selected: number; approximate: number };
  geometry: { type: "LineString"; coordinates: LngLat[] };
};

function resolveRoutes(routes: MapDayRoute[] | undefined, stops: MapStop[] | undefined): MapDayRoute[] {
  if (routes) return routes;
  if (stops?.length) return [{ id: "day", label: "Day", color: FALLBACK_COLOR, stops }];
  return [];
}

function validStops(stops: MapStop[]) {
  return stops.filter(
    (stop) =>
      Number.isFinite(stop.lat) &&
      Number.isFinite(stop.lng) &&
      Math.abs(stop.lat) <= 90 &&
      Math.abs(stop.lng) <= 180 &&
      !(stop.lat === 0 && stop.lng === 0),
  );
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] as RouteFeature[] };
}

function lineFeature(
  coordinates: LngLat[],
  properties: RouteFeature["properties"],
): RouteFeature {
  return {
    type: "Feature",
    properties,
    geometry: { type: "LineString", coordinates },
  };
}

function directionsUrl(stops: MapStop[]) {
  const point = (stop: MapStop) => `${stop.lat},${stop.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: point(stops[0]!),
    destination: point(stops.at(-1)!),
    travelmode: "walking",
  });
  const waypoints = stops.slice(1, -1).map(point).join("|");
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params}`;
}

function MapboxDayMap({
  token,
  routes,
  selectedRouteId,
  center,
  focus,
  pinMode,
  pendingPin,
  previewPlace,
  onPin,
  onPlaceLabel,
  onPreviewClick,
}: {
  token: string;
  routes: MapDayRoute[];
  selectedRouteId: string | null;
  center: { lat: number; lng: number } | null;
  focus: { lat: number; lng: number; nonce: number } | null;
  pinMode: boolean;
  pendingPin: { lat: number; lng: number } | null;
  previewPlace: MapPreviewPlace | null;
  onPin?: (coords: { lat: number; lng: number }) => void;
  onPlaceLabel?: (place: MapPlaceLabel) => void;
  onPreviewClick?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const pendingMarker = useRef<Marker | null>(null);
  const previewMarker = useRef<Marker | null>(null);
  const linesRef = useRef<RouteFeature[]>([]);
  const selectedRef = useRef(selectedRouteId);
  const pinModeRef = useRef(pinMode);
  const onPinRef = useRef(onPin);
  const onPlaceLabelRef = useRef(onPlaceLabel);
  const onPreviewClickRef = useRef(onPreviewClick);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const initialCenter = useRef(center);
  pinModeRef.current = pinMode;
  onPinRef.current = onPin;
  onPlaceLabelRef.current = onPlaceLabel;
  onPreviewClickRef.current = onPreviewClick;
  selectedRef.current = selectedRouteId;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const root = el;

    let cancelled = false;
    let map: MapboxMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    function sized() {
      return root.clientWidth >= 2 && root.clientHeight >= 2;
    }

    function start() {
      if (cancelled || map || !sized()) return;
      void import("mapbox-gl")
        .then(({ default: mapboxgl }) => {
          if (cancelled || map || !sized()) return;
          mapboxgl.accessToken = token;
          try {
            map = new mapboxgl.Map({
              container: root,
              style: "mapbox://styles/mapbox/streets-v12",
              center: initialCenter.current
                ? [initialCenter.current.lng, initialCenter.current.lat]
                : [0, 20],
              zoom: initialCenter.current ? 11 : 2,
              attributionControl: true,
              failIfMajorPerformanceCaveat: false,
            });
          } catch (error) {
            console.error(error);
            setFailed(true);
            return;
          }
          map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
          map.on("error", (event) => {
            console.error(event.error);
          });
          map.on("click", (event) => {
            const active = map;
            if (!active) return;
            const label = namedPoiAt(active, event.point);
            if (label && onPlaceLabelRef.current) {
              onPlaceLabelRef.current(label);
              return;
            }
            if (!pinModeRef.current) return;
            onPinRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
          });
          map.on("mousemove", (event) => {
            const active = map;
            if (!active) return;
            const canvas = active.getCanvas();
            if (!canvas) return;
            if (onPlaceLabelRef.current && namedPoiAt(active, event.point)) {
              canvas.style.cursor = "pointer";
              return;
            }
            canvas.style.cursor = pinModeRef.current ? "crosshair" : "";
          });
          map.on("load", () => {
            if (!map) return;
            map.resize();
            requestAnimationFrame(() => map?.resize());
            map.addSource("routes", {
              type: "geojson",
              data: emptyCollection(),
            });
            map.addLayer({
              id: "route-casing",
              type: "line",
              source: "routes",
              filter: ["!=", ["get", "approximate"], 1],
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#fff", "line-width": 6, "line-opacity": 0.9 },
            });
            map.addLayer({
              id: "routes",
              type: "line",
              source: "routes",
              filter: ["!=", ["get", "approximate"], 1],
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": ["coalesce", ["get", "color"], FALLBACK_COLOR],
                "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3.5],
                "line-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0.72],
              },
            });
            map.addLayer({
              id: "routes-approximate",
              type: "line",
              source: "routes",
              filter: ["==", ["get", "approximate"], 1],
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": ["coalesce", ["get", "color"], FALLBACK_COLOR],
                "line-width": ["case", ["==", ["get", "selected"], 1], 5, 3.5],
                "line-opacity": 0.85,
                "line-dasharray": [1.5, 1.5],
              },
            });
            mapRef.current = map;
            setReady(true);
          });
        })
        .catch((error) => {
          console.error(error);
          setFailed(true);
        });
    }

    function onSize() {
      if (root.clientWidth === lastWidth && root.clientHeight === lastHeight) return;
      lastWidth = root.clientWidth;
      lastHeight = root.clientHeight;
      start();
      map?.resize();
    }

    resizeObserver = new ResizeObserver(onSize);
    resizeObserver.observe(el);
    if (typeof IntersectionObserver !== "undefined") {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) {
            start();
            map?.resize();
          }
        },
        { threshold: 0.01 },
      );
      visibilityObserver.observe(el);
    }
    start();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      pendingMarker.current?.remove();
      pendingMarker.current = null;
      previewMarker.current?.remove();
      previewMarker.current = null;
      setReady(false);
      mapRef.current = null;
      map?.remove();
      map = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    const abort = new AbortController();

    void import("mapbox-gl").then(async ({ default: mapboxgl }) => {
      if (cancelled) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = routes.flatMap((route) =>
        validStops(route.stops).map((stop, index) => {
          const element = document.createElement("div");
          element.className =
            "flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md";
          element.style.backgroundColor = route.color;
          element.textContent = String(index + 1);
          element.title = `${route.label}: ${stop.label}`;
          return new mapboxgl.Marker({ element }).setLngLat([stop.lng, stop.lat]).addTo(map);
        }),
      );

      const features = (
        await Promise.all(
          routes.flatMap((route) => {
            const dayStops = validStops(route.stops);
            return dayStops.slice(0, -1).map(async (stop, index) => {
              const next = dayStops[index + 1];
              if (!next || !stop.departMode) return null;
              const routed = await fetchTravelLine(
                { lat: stop.lat, lng: stop.lng },
                { lat: next.lat, lng: next.lng },
                stop.departMode,
                token,
                abort.signal,
              );
              if (cancelled) return null;
              const line = routed ?? [stop, next].map((point): LngLat => [point.lng, point.lat]);
              return lineFeature(line, {
                color: route.color,
                dayId: route.id,
                selected: route.id === selectedRef.current ? 1 : 0,
                approximate: routed ? 0 : 1,
              });
            });
          }),
        )
      ).filter((feature): feature is RouteFeature => feature !== null);

      if (cancelled) return;
      linesRef.current = features;
      (map.getSource("routes") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features,
      });

      const allValid = routes.flatMap((route) => validStops(route.stops));
      if (!pinModeRef.current) {
        if (allValid.length === 1) {
          map.easeTo({ center: [allValid[0]!.lng, allValid[0]!.lat], zoom: 14 });
        } else if (allValid.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          allValid.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
          features.forEach((feature) => feature.geometry.coordinates.forEach((coord) => bounds.extend(coord)));
          map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 600 });
        }
      }
      map.resize();
    });
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [ready, routes, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || linesRef.current.length === 0) return;
    const features = linesRef.current.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        selected: feature.properties.dayId === selectedRouteId ? 1 : 0,
      },
    }));
    linesRef.current = features;
    (map.getSource("routes") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
  }, [ready, selectedRouteId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    map.easeTo({
      center: [focus.lng, focus.lat],
      zoom: 14,
      duration: 800,
    });
  }, [ready, focus?.lat, focus?.lng, focus?.nonce]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const canvas = map.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = pinMode ? "crosshair" : "";
    return () => {
      const next = map.getCanvas();
      if (next) next.style.cursor = "";
    };
  }, [ready, pinMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!pendingPin) {
      pendingMarker.current?.remove();
      pendingMarker.current = null;
      return;
    }
    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      const previous = pendingMarker.current?.getLngLat();
      const jumped =
        !previous ||
        Math.hypot(previous.lat - pendingPin.lat, previous.lng - pendingPin.lng) > 0.0004;
      if (pendingMarker.current) {
        pendingMarker.current.setLngLat([pendingPin.lng, pendingPin.lat]);
      } else {
        const element = document.createElement("div");
        element.className =
          "flex size-8 items-center justify-center rounded-full border-2 border-white bg-orange-600 text-white shadow-lg";
        element.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
        const marker = new mapboxgl.Marker({ element, draggable: true, anchor: "center" })
          .setLngLat([pendingPin.lng, pendingPin.lat])
          .addTo(map);
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onPinRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
        });
        pendingMarker.current = marker;
      }
      if (jumped) {
        map.easeTo({
          center: [pendingPin.lng, pendingPin.lat],
          zoom: Math.max(map.getZoom(), 14),
          duration: 700,
        });
      }
    });
  }, [ready, pendingPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!previewPlace || pendingPin) {
      previewMarker.current?.remove();
      previewMarker.current = null;
      return;
    }
    void import("mapbox-gl").then(({ default: mapboxgl }) => {
      const element = document.createElement("div");
      element.className = "flex flex-col items-center gap-0.5";
      const label = document.createElement("button");
      label.type = "button";
      label.textContent = previewPlace.label;
      label.setAttribute("aria-label", `Add ${previewPlace.label}`);
      label.className =
        "max-w-[11rem] truncate rounded-full bg-background px-2 py-1 text-xs font-semibold shadow-md ring-1 ring-foreground/10 hover:bg-orange-50";
      label.addEventListener("click", (event) => {
        event.stopPropagation();
        onPreviewClickRef.current?.();
      });
      const dot = document.createElement("div");
      dot.className = "size-2.5 rounded-full border-2 border-white bg-orange-600 shadow";
      element.append(label, dot);
      previewMarker.current?.remove();
      previewMarker.current = new mapboxgl.Marker({ element, anchor: "bottom" })
        .setLngLat([previewPlace.lng, previewPlace.lat])
        .addTo(map);
    });
    return () => {
      previewMarker.current?.remove();
      previewMarker.current = null;
    };
  }, [ready, previewPlace, pendingPin]);

  return (
    <>
      {failed ? <RouteSketch routes={routes} /> : null}
      <div
        ref={container}
        className="absolute inset-0 h-full w-full"
        aria-label="Map of trip stops"
        role="region"
        hidden={failed}
      />
    </>
  );
}

function RouteSketch({ routes }: { routes: MapDayRoute[] }) {
  const plotted = routes
    .map((route) => ({ route, stops: validStops(route.stops) }))
    .filter((entry) => entry.stops.length > 0);
  if (plotted.length === 0) return null;

  const width = 400;
  const height = 300;
  const padding = 36;
  const allStops = plotted.flatMap((entry) => entry.stops);
  const meanLat = allStops.reduce((sum, stop) => sum + stop.lat, 0) / allStops.length;
  const xScale = Math.cos((meanLat * Math.PI) / 180);
  const xs = allStops.map((stop) => stop.lng * xScale);
  const ys = allStops.map((stop) => stop.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 0.002);
  const scale = Math.min(width - padding * 2, height - padding * 2) / span;
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const project = (stop: MapStop) => ({
    x: offsetX + (stop.lng * xScale - minX) * scale,
    y: height - (offsetY + (stop.lat - minY) * scale),
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 size-full"
      role="img"
      aria-label={`Routes for ${plotted.map((entry) => entry.route.label).join(", ")}`}
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity="0.06" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)" />
      {plotted.map(({ route, stops }) => {
        const points = stops.map(project);
        return (
          <g key={route.id}>
            {stops.slice(0, -1).map((stop, index) => {
              const next = points[index + 1];
              const start = points[index];
              if (!stop.departMode || !start || !next) return null;
              return (
                <line
                  key={`${stop.id}-leg`}
                  x1={start.x}
                  y1={start.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={route.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              );
            })}
            {points.map((point, index) => (
              <g key={stops[index]!.id}>
                <circle cx={point.x} cy={point.y} r="12" fill={route.color} stroke="white" strokeWidth="2.5" />
                <text
                  x={point.x}
                  y={point.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="700"
                  fill="white"
                >
                  {index + 1}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
