"use client";

import { Bike, Car, Footprints, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ItineraryItem, ItineraryPlace } from "@/lib/data/trip";
import { addMinutesToTime, clockMinutes, formatDuration, formatTime } from "@/lib/format";
import {
  TRAVEL_MODES,
  approximateLeg,
  fetchTravelLeg,
  formatDistance,
  travelMode,
  type TravelEstimate,
  type TravelMode,
} from "@/lib/travel-estimate";
import { cn } from "@/lib/utils";

const MODE_ICONS = {
  driving: Car,
  walking: Footprints,
  cycling: Bike,
} as const;

export function hasCoordinates(item: ItineraryItem): item is ItineraryItem & { place: ItineraryPlace } {
  const place = item.place;
  if (!place) return false;
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Math.abs(place.lat) <= 90 &&
    Math.abs(place.lng) <= 180 &&
    !(place.lat === 0 && place.lng === 0)
  );
}

export function previousLocated(items: ItineraryItem[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = items[cursor];
    if (candidate && hasCoordinates(candidate)) return candidate;
  }
  return null;
}

function storageKey(fromId: string, toId: string) {
  return `planner-travel:${fromId}:${toId}`;
}

export function TravelGap({
  from,
  to,
  mode,
  onMode,
  onMinutes,
}: {
  from: ItineraryItem & { place: ItineraryPlace };
  to: ItineraryItem & { place: ItineraryPlace };
  mode: TravelMode | null;
  onMode: (mode: TravelMode | null) => void;
  onMinutes?: (itemId: string, minutes: number | null) => void;
}) {
  const [estimate, setEstimate] = useState<TravelEstimate | null>(null);
  const [pending, setPending] = useState(false);
  const key = storageKey(from.id, to.id);
  const migrated = useRef<string | null>(null);

  useEffect(() => {
    if (mode) {
      window.localStorage.setItem(key, mode);
      return;
    }
    if (migrated.current === key) return;
    migrated.current = key;
    const saved = travelMode(window.localStorage.getItem(key));
    if (saved) onMode(saved);
  }, [key, mode, onMode]);

  useEffect(() => {
    onMinutes?.(to.id, estimate?.minutes ?? null);
  }, [estimate?.minutes, onMinutes, to.id]);

  useEffect(() => {
    return () => onMinutes?.(to.id, null);
  }, [onMinutes, to.id]);

  useEffect(() => {
    if (!mode) {
      setEstimate(null);
      setPending(false);
      return;
    }
    const controller = new AbortController();
    setPending(true);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    const origin = { lat: from.place.lat, lng: from.place.lng };
    const destination = { lat: to.place.lat, lng: to.place.lng };
    void (async () => {
      const routed = await fetchTravelLeg(origin, destination, mode, token, controller.signal);
      if (controller.signal.aborted) return;
      setEstimate(routed ?? approximateLeg(origin, destination, mode));
      setPending(false);
    })();
    return () => controller.abort();
  }, [from.place.lat, from.place.lng, mode, to.place.lat, to.place.lng]);

  function choose(next: TravelMode) {
    window.localStorage.setItem(key, next);
    onMode(next);
  }

  function clear() {
    window.localStorage.removeItem(key);
    onMode(null);
    setEstimate(null);
  }

  const leave = from.start_time ? addMinutesToTime(from.start_time, from.duration_minutes ?? 0) : null;
  const arrive = leave && estimate ? addMinutesToTime(leave, estimate.minutes) : null;
  const nextStart = to.start_time ? clockMinutes(to.start_time) : null;
  const arrivalMinutes = arrive ? clockMinutes(arrive) : null;
  const late = nextStart != null && arrivalMinutes != null && arrivalMinutes > nextStart;
  const schedule =
    leave && arrive
      ? `Leave ${formatTime(leave)} · arrive ${formatTime(arrive)}${late ? " · after the scheduled time" : ""}`
      : null;

  const noun = TRAVEL_MODES.find((entry) => entry.id === mode)?.noun;
  const Icon = mode ? MODE_ICONS[mode] : Plus;
  const label = pending
    ? "Estimating"
    : estimate && noun
      ? estimate.approximate
        ? `About ${formatDuration(estimate.minutes)} · ${formatDistance(estimate.meters)}`
        : `${formatDuration(estimate.minutes)} ${noun} · ${formatDistance(estimate.meters)}`
      : "Add transportation";
  const chosen = Boolean(mode);

  return (
    <li className={cn("relative", chosen || pending ? "group/leg flex justify-center py-0.5" : "h-0")}>
      <div
        className={cn(
          "flex items-center justify-center",
          chosen || pending
            ? "relative"
            : "group/leg absolute top-1/2 left-1/2 z-10 h-8 w-48 -translate-x-1/2 -translate-y-1/2",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={label}
            className={cn(
              "flex items-center justify-center text-muted-foreground outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:opacity-100",
              chosen || pending
                ? "gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs shadow-xs ring-1 ring-foreground/10"
                : "size-6 rounded-full bg-card opacity-40 shadow-sm ring-1 ring-foreground/15 group-hover/leg:opacity-100 focus-visible:opacity-100",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {chosen || pending ? (
              <span className="flex flex-col items-start leading-tight">
                <span>{label}</span>
                {schedule ? <span className={late ? "text-orange-700" : undefined}>{schedule}</span> : null}
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {TRAVEL_MODES.map((entry) => {
              const ModeIcon = MODE_ICONS[entry.id];
              return (
                <DropdownMenuItem key={entry.id} onClick={() => choose(entry.id)}>
                  <ModeIcon />
                  {entry.label}
                </DropdownMenuItem>
              );
            })}
            {chosen ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clear}>Remove</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
