"use client";

import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createItineraryItem } from "@/app/(app)/trips/itinerary-actions";
import { CATEGORY_LABELS } from "@/components/trips/place-picker";
import { Button } from "@/components/ui/button";
import type { PlaceSummary } from "@/lib/data/catalog";
import { positionBetween } from "@/lib/trip-blocks";

export function ExploreBoard({
  tripId,
  destinationName,
  places,
  canEdit,
  days,
  positions,
  savedIds,
}: {
  tripId: string;
  destinationName: string;
  places: PlaceSummary[];
  canEdit: boolean;
  days: { date: string; label: string }[];
  positions: Record<string, number>;
  savedIds: string[];
}) {
  const [category, setCategory] = useState<PlaceSummary["category"] | "all">("all");
  const [day, setDay] = useState(days[0]?.date ?? "");
  const [added, setAdded] = useState(() => new Set(savedIds));
  const [lastPosition, setLastPosition] = useState(positions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const categories = [...new Set(places.map((place) => place.category))];
  const visible = category === "all" ? places : places.filter((place) => place.category === category);

  async function add(place: PlaceSummary) {
    if (!day || pendingId) return;
    const position = positionBetween(lastPosition[day], undefined);
    setPendingId(place.id);
    const result = await createItineraryItem({
      id: crypto.randomUUID(),
      tripId,
      day_date: day,
      position,
      placeId: place.id,
      title: null,
    });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLastPosition((current) => ({ ...current, [day]: position }));
    setAdded((current) => new Set(current).add(place.id));
    const label = days.find((entry) => entry.date === day)?.label ?? "the itinerary";
    toast.success(`Added ${place.name} to ${label}`);
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Explore {destinationName}</h1>
          <p className="text-sm text-muted-foreground">Places for this destination. Add one to a day on the itinerary.</p>
        </div>
        {canEdit && days.length > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Add to</span>
            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="h-9 rounded-md bg-background px-2 ring-1 ring-foreground/10"
            >
              {days.map((entry) => (
                <option key={entry.date} value={entry.date}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip selected={category === "all"} onClick={() => setCategory("all")}>
          All
        </FilterChip>
        {categories.map((entry) => (
          <FilterChip key={entry} selected={category === entry} onClick={() => setCategory(entry)}>
            {CATEGORY_LABELS[entry]}
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No places saved for this destination yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((place) => (
            <li key={place.id} className="flex gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                <MapPin className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{place.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {CATEGORY_LABELS[place.category]}
                  {place.address ? ` · ${place.address}` : ""}
                  {place.rating != null ? ` · ${place.rating}` : ""}
                </p>
                {added.has(place.id) ? <p className="mt-1 text-xs text-orange-700">On this itinerary</p> : null}
              </div>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === place.id}
                  onClick={() => void add(place)}
                >
                  <Plus />
                  Add
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-full bg-orange-600 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {children}
    </button>
  );
}
