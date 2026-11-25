"use client";

import { ListChecks, Loader2, LocateFixed, MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveMapboxPlace, savePinnedPlace } from "@/app/(app)/trips/place-actions";
import { DayMap, type MapPlaceLabel } from "@/components/trips/itinerary/day-map";
import { Button } from "@/components/ui/button";
import type { PlaceSearchHit, PlaceSummary } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export const CATEGORY_LABELS: Record<PlaceSummary["category"], string> = {
  attraction: "Attraction",
  restaurant: "Restaurant",
  fast_food: "Fast food",
  cafe: "Cafe",
  hotel: "Hotel",
  nightlife: "Nightlife",
};

export type MapPinDraft = {
  awaitingClick: boolean;
  lat: number | null;
  lng: number | null;
  suggestedName: string;
  suggestedAddress: string | null;
  lookingUp: boolean;
  saving: boolean;
};

function hasCoords(place: { lat: number; lng: number }) {
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180 &&
    !(place.lat === 0 && place.lng === 0)
  );
}

export function PlacePicker({
  destinationId,
  excludeIds,
  listPlaces = [],
  onPick,
  onClose,
  onPinMap,
  pin: externalPin,
  onCancelPin,
  onConfirmPin,
  onDropPin,
  onLocate,
  enablePin = false,
  center = null,
}: {
  destinationId: string | null;
  excludeIds: string[];
  listPlaces?: PlaceSummary[];
  onPick: (place: PlaceSummary) => void;
  onClose: () => void;
  onPinMap?: () => void;
  pin?: MapPinDraft | null;
  onCancelPin?: () => void;
  onConfirmPin?: (name: string) => void;
  onDropPin?: (coords: { lat: number; lng: number }) => void;
  onLocate?: (coords: { lat: number; lng: number }) => void;
  enablePin?: boolean;
  center?: { lat: number; lng: number } | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; places: PlaceSearchHit[] } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pinName, setPinName] = useState("");
  const [internalPin, setInternalPin] = useState<MapPinDraft | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [previewPlace, setPreviewPlace] = useState<PlaceSearchHit | null>(null);
  const pinLookup = useRef(0);
  const [session] = useState(() => crypto.randomUUID());
  const key = `${destinationId ?? ""}|${query.trim()}`;
  const pin = externalPin ?? internalPin;
  const canPin = enablePin || Boolean(onPinMap);
  const pinCoords = pin?.lat != null && pin.lng != null ? { lat: pin.lat, lng: pin.lng } : null;
  const showEmbeddedMap = canPin;

  useEffect(() => {
    setPinName(pin?.suggestedName ?? "");
  }, [pin?.suggestedName]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim(), session });
      if (destinationId) params.set("destination", destinationId);
      try {
        const response = await fetch(`/api/places?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Place search failed");
        setResults({ key, places: await response.json() });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setResults({ key, places: [] });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, query, destinationId, session]);

  const current = results?.key === key ? results.places : null;
  const loading = current === null;
  const q = query.trim().toLowerCase();
  const fromLists = listPlaces.filter((place) => {
    if (excludeIds.includes(place.id)) return false;
    if (!q) return true;
    return (
      place.name.toLowerCase().includes(q) || Boolean(place.address?.toLowerCase().includes(q))
    );
  });
  const fromListIds = new Set(fromLists.map((place) => place.id));
  const places = (current ?? []).filter(
    (place) => !excludeIds.includes(place.id) && !fromListIds.has(place.id),
  );

  function cancelPin() {
    pinLookup.current += 1;
    setPreviewPlace(null);
    if (onPinMap) {
      onCancelPin?.();
      return;
    }
    setInternalPin(null);
  }

  function dropPin(coords: { lat: number; lng: number }) {
    const request = ++pinLookup.current;
    setInternalPin({
      awaitingClick: false,
      lat: coords.lat,
      lng: coords.lng,
      suggestedName: "Dropped pin",
      suggestedAddress: null,
      lookingUp: true,
      saving: false,
    });
    void (async () => {
      try {
        const response = await fetch(`/api/places/reverse?lng=${coords.lng}&lat=${coords.lat}`);
        const body = (await response.json()) as { name?: string; address?: string | null };
        if (request !== pinLookup.current) return;
        setInternalPin((current) =>
          current
            ? {
                ...current,
                lookingUp: false,
                suggestedName: body.name?.trim() || current.suggestedName || "Dropped pin",
                suggestedAddress: body.address ?? current.suggestedAddress,
              }
            : current,
        );
      } catch {
        if (request !== pinLookup.current) return;
        setInternalPin((current) => (current ? { ...current, lookingUp: false } : current));
      }
    })();
  }

  function handleMapPin(coords: { lat: number; lng: number }) {
    setPreviewPlace(null);
    if (onDropPin) onDropPin(coords);
    else dropPin(coords);
  }

  function locateOnMap(place: PlaceSearchHit) {
    if (!hasCoords(place)) return;
    cancelPin();
    const coords = { lat: place.lat, lng: place.lng };
    setPreviewPlace(place);
    setMapFocus({ ...coords, nonce: Date.now() });
    onLocate?.(coords);
  }

  function matchVisiblePlace(label: MapPlaceLabel) {
    const pool = [...fromLists, ...places];
    const name = label.name.trim().toLowerCase();
    return (
      pool.find((place) => place.name.trim().toLowerCase() === name) ??
      pool.find(
        (place) =>
          hasCoords(place) &&
          Math.hypot(place.lat - label.lat, place.lng - label.lng) < 0.012 &&
          (place.name.toLowerCase().includes(name) || name.includes(place.name.toLowerCase())),
      )
    );
  }

  async function addFromMapLabel(label: MapPlaceLabel) {
    if (savingId) return;
    const visible = matchVisiblePlace(label);
    if (visible) {
      await pick(visible);
      return;
    }
    if (previewPlace && previewPlace.name.trim().toLowerCase() === label.name.trim().toLowerCase()) {
      await pick(previewPlace);
      return;
    }
    const params = new URLSearchParams({ q: label.name, session });
    if (destinationId) params.set("destination", destinationId);
    try {
      const response = await fetch(`/api/places?${params}`);
      if (response.ok) {
        const hits = (await response.json()) as PlaceSearchHit[];
        const match =
          hits.find((place) => place.name.trim().toLowerCase() === label.name.trim().toLowerCase()) ??
          hits.find(
            (place) =>
              hasCoords(place) && Math.hypot(place.lat - label.lat, place.lng - label.lng) < 0.02,
          ) ??
          hits[0];
        if (match && !excludeIds.includes(match.id)) {
          await pick(match);
          return;
        }
        if (match && excludeIds.includes(match.id)) {
          toast.error("That's already added.");
          return;
        }
      }
    } catch (error) {
      console.error(error);
    }
    if (!destinationId) {
      toast.error("Add a destination to this trip first.");
      return;
    }
    setSavingId("map-label");
    const result = await savePinnedPlace({
      name: label.name,
      lat: label.lat,
      lng: label.lng,
      destinationId,
    });
    setSavingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onPick(result.place);
  }

  async function confirmEmbeddedPin(name: string) {
    if (!internalPin || internalPin.lat == null || internalPin.lng == null || !destinationId || internalPin.saving) {
      return;
    }
    setInternalPin((current) => (current ? { ...current, saving: true } : current));
    const result = await savePinnedPlace({
      name,
      address: internalPin.suggestedAddress,
      lat: internalPin.lat,
      lng: internalPin.lng,
      destinationId,
    });
    if (!result.ok) {
      toast.error(result.error);
      setInternalPin((current) => (current ? { ...current, saving: false } : current));
      return;
    }
    setInternalPin(null);
    onPick(result.place);
  }

  async function confirmCurrentPin(name: string) {
    if (onPinMap) {
      onConfirmPin?.(name);
      return;
    }
    await confirmEmbeddedPin(name);
  }

  function close() {
    cancelPin();
    onClose();
  }

  async function pick(place: PlaceSearchHit) {
    if (savingId) return;
    if (!place.mapboxId) {
      onPick(place);
      return;
    }
    setSavingId(place.id);
    const result = await saveMapboxPlace(place, destinationId, session);
    setSavingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onPick(result.place);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-2">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && close()}
          placeholder={destinationId ? "Search places in this destination" : "Search places"}
          aria-label="Search places"
          className="h-9 w-full rounded-lg border bg-background pr-9 pl-8 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="button"
          onClick={close}
          aria-label="Close place search"
          className="absolute right-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      {showEmbeddedMap ? (
        <DayMap
          compact={true}
          title="Pin a place"
          stops={[]}
          center={pinCoords ?? center}
          focus={mapFocus}
          pinMode
          pendingPin={pinCoords}
          previewPlace={
            previewPlace && hasCoords(previewPlace)
              ? { label: previewPlace.name, lat: previewPlace.lat, lng: previewPlace.lng }
              : null
          }
          onPin={handleMapPin}
          onPlaceLabel={(label) => void addFromMapLabel(label)}
          onPreviewClick={() => previewPlace && void pick(previewPlace)}
        />
      ) : null}
      {pin && pin.lat != null ? (
        <PinForm pin={pin} name={pinName} onNameChange={setPinName} onConfirm={(name) => void confirmCurrentPin(name)} />
      ) : null}
      <div className={cn("flex flex-col gap-2 overflow-y-auto", showEmbeddedMap ? "max-h-48" : "max-h-72")}>
        {fromLists.length > 0 ? (
          <div>
            <p className="flex items-center gap-1.5 px-2 pb-1 text-xs font-medium text-muted-foreground">
              <ListChecks className="size-3.5" aria-hidden />
              From your lists
            </p>
            <ul className="flex flex-col">
              {fromLists.map((place) => (
                <li key={place.id}>
                  <PlaceResultButton
                    place={place}
                    savingId={savingId}
                    onPick={() => void pick(place)}
                    onLocate={canPin ? () => locateOnMap(place) : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {loading ? (
          <p className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </p>
        ) : places.length === 0 && fromLists.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">No places found.</p>
        ) : places.length > 0 ? (
          <ul className="flex flex-col">
            {fromLists.length > 0 ? (
              <li className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Search</li>
            ) : null}
            {places.map((place) => (
              <li key={place.id}>
                <PlaceResultButton
                  place={place}
                  savingId={savingId}
                  onPick={() => void pick(place)}
                  onLocate={canPin ? () => locateOnMap(place) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function PlaceResultButton({
  place,
  savingId,
  onPick,
  onLocate,
}: {
  place: PlaceSearchHit;
  savingId: string | null;
  onPick: () => void;
  onLocate?: () => void;
}) {
  const canLocate = Boolean(onLocate) && hasCoords(place);
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={savingId !== null}
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background disabled:opacity-60"
      >
        {savingId === place.id ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-600" aria-hidden />
        ) : (
          <Plus className="size-4 shrink-0 text-orange-600" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{place.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {CATEGORY_LABELS[place.category]}
            {place.address ? ` · ${place.address}` : ""}
          </span>
        </span>
      </button>
      {canLocate ? (
        <button
          type="button"
          onClick={onLocate}
          aria-label={`Show ${place.name} on map`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-orange-600"
        >
          <LocateFixed className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function PinForm({
  pin,
  name,
  onNameChange,
  onConfirm,
}: {
  pin: MapPinDraft;
  name: string;
  onNameChange: (value: string) => void;
  onConfirm?: (name: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || pin.saving) return;
        onConfirm?.(trimmed);
      }}
    >
      <label className="flex flex-col gap-1 px-1">
        <span className="text-xs font-medium text-muted-foreground">Place name</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={120}
          placeholder={pin.lookingUp ? "Looking up this spot…" : "Name this pin"}
          aria-label="Pin name"
          className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <p className="px-1 text-xs text-muted-foreground">
        {pin.lookingUp
          ? "Finding an address…"
          : pin.suggestedAddress
            ? pin.suggestedAddress
            : pin.lat != null && pin.lng != null
              ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
              : "Drag the pin to set the exact spot."}
      </p>
      <Button type="submit" size="sm" disabled={pin.saving || !name.trim()}>
        {pin.saving ? <Loader2 className="animate-spin" /> : <MapPin />}
        Add pin
      </Button>
    </form>
  );
}
