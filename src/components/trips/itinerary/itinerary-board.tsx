"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Map as MapIcon, MapPin, PenLine } from "lucide-react";
import { Fragment, useCallback, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { savePinnedPlace } from "@/app/(app)/trips/place-actions";
import {
  createItineraryItem,
  deleteItineraryItem,
  updateItineraryItem,
  type ItineraryPatch,
} from "@/app/(app)/trips/itinerary-actions";
import { DayMap, dayRouteColor, type MapDayRoute } from "@/components/trips/itinerary/day-map";
import { ItemDragPreview, ItineraryItemCard, itemLabel } from "@/components/trips/itinerary/itinerary-item-card";
import { TravelGap, hasCoordinates, previousLocated } from "@/components/trips/itinerary/travel-gap";
import { PlacePicker, type MapPinDraft } from "@/components/trips/place-picker";
import { Button } from "@/components/ui/button";
import type { PlaceSummary } from "@/lib/data/catalog";
import type { ItineraryItem } from "@/lib/data/trip";
import { formatDay, formatDuration, pluralize } from "@/lib/format";
import { positionBetween } from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

type Columns = Record<string, ItineraryItem[]>;

function locatedStops(items: ItineraryItem[]) {
  return items.filter(hasCoordinates);
}

function groupByDay(days: string[], items: ItineraryItem[]): Columns {
  const columns: Columns = Object.fromEntries(days.map((day) => [day, []]));
  for (const item of items) {
    // Clamp strays (e.g. rows written before the trip dates changed) onto the nearest day.
    const day = item.day_date < days[0]! ? days[0]! : item.day_date > days.at(-1)! ? days.at(-1)! : item.day_date;
    columns[day]!.push(item);
  }
  for (const day of days) columns[day]!.sort((a, b) => a.position - b.position);
  return columns;
}

export function ItineraryBoard({
  tripId,
  days,
  initialItems,
  listPlaces,
  canEdit,
  destinationId,
  center,
}: {
  tripId: string;
  days: string[];
  initialItems: ItineraryItem[];
  listPlaces: PlaceSummary[];
  canEdit: boolean;
  destinationId: string | null;
  center: { lat: number; lng: number } | null;
}) {
  const dndId = useId();
  const [columns, setColumns] = useState(() => groupByDay(days, initialItems));
  const [selectedDay, setSelectedDay] = useState(days[0]!);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMapOnMobile, setShowMapOnMobile] = useState(false);
  const [pinning, setPinning] = useState<(MapPinDraft & { day: string }) | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const pinLookup = useRef(0);
  const dragStart = useRef<Columns | null>(null);
  const canPin = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  const findDay = (id: string, source = columns) =>
    id in source ? id : Object.keys(source).find((day) => source[day]!.some((item) => item.id === id));

  const allItems = useMemo(() => Object.values(columns).flat(), [columns]);
  const activeItem = activeId ? allItems.find((item) => item.id === activeId) : undefined;

  function patchLocal(itemId: string, patch: Partial<ItineraryItem>) {
    setColumns((current) => {
      const next: Columns = {};
      for (const [day, items] of Object.entries(current)) {
        next[day] = items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
      }
      return next;
    });
  }

  async function updateItem(itemId: string, patch: ItineraryPatch) {
    const before = allItems.find((item) => item.id === itemId);
    patchLocal(itemId, patch);
    const result = await updateItineraryItem(itemId, patch);
    if (!result.ok && result.error === "TRAVEL_MODE_UNAVAILABLE") return;
    if (!result.ok) {
      toast.error(result.error);
      if (before) {
        const keys = Object.keys(patch) as (keyof ItineraryPatch)[];
        patchLocal(itemId, Object.fromEntries(keys.map((key) => [key, before[key]])));
      }
    }
  }

  async function removeItem(itemId: string) {
    const snapshot = columns;
    setColumns((current) =>
      Object.fromEntries(Object.entries(current).map(([day, items]) => [day, items.filter((i) => i.id !== itemId)])),
    );
    const result = await deleteItineraryItem(itemId);
    if (!result.ok) {
      toast.error(result.error);
      setColumns(snapshot);
    }
  }

  function startPin(day: string) {
    if (!destinationId) {
      toast.error("Add a destination to this trip first.");
      return;
    }
    setSelectedDay(day);
    setShowMapOnMobile(true);
    setPinning({
      day,
      awaitingClick: true,
      lat: null,
      lng: null,
      suggestedName: "",
      suggestedAddress: null,
      lookingUp: false,
      saving: false,
    });
  }

  function dropPin(coords: { lat: number; lng: number }, day = pinning?.day) {
    if (!destinationId) {
      toast.error("Add a destination to this trip first.");
      return;
    }
    if (!day) return;
    const request = ++pinLookup.current;
    setSelectedDay(day);
    setShowMapOnMobile(true);
    setPinning({
      day,
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
        setPinning((current) =>
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
        setPinning((current) => (current ? { ...current, lookingUp: false } : current));
      }
    })();
  }

  async function confirmPin(name: string) {
    if (!pinning || pinning.lat == null || pinning.lng == null || !destinationId || pinning.saving) return false;
    setPinning((current) => (current ? { ...current, saving: true } : current));
    const result = await savePinnedPlace({
      name,
      address: pinning.suggestedAddress,
      lat: pinning.lat,
      lng: pinning.lng,
      destinationId,
    });
    if (!result.ok) {
      toast.error(result.error);
      setPinning((current) => (current ? { ...current, saving: false } : current));
      return false;
    }
    const day = pinning.day;
    setPinning(null);
    await addItem(day, { place: result.place });
    return true;
  }

  async function addItem(day: string, subject: { place: PlaceSummary } | { title: string }) {
    const dayItems = columns[day] ?? [];
    const item: ItineraryItem = {
      id: crypto.randomUUID(),
      day_date: day,
      position: positionBetween(dayItems.at(-1)?.position, undefined),
      title: "title" in subject ? subject.title : null,
      start_time: null,
      duration_minutes: null,
      notes: null,
      travel_mode: null,
      place:
        "place" in subject
          ? {
              id: subject.place.id,
              name: subject.place.name,
              category: subject.place.category,
              address: subject.place.address,
              lat: subject.place.lat,
              lng: subject.place.lng,
              photo_url: subject.place.photo_url,
            }
          : null,
    };
    setColumns((current) => ({ ...current, [day]: [...(current[day] ?? []), item] }));
    setSelectedDay(day);

    const result = await createItineraryItem({
      id: item.id,
      tripId,
      day_date: day,
      position: item.position,
      placeId: item.place?.id ?? null,
      title: item.title,
    });
    if (!result.ok) {
      toast.error(result.error);
      setColumns((current) => ({ ...current, [day]: (current[day] ?? []).filter((i) => i.id !== item.id) }));
    }
  }

  function onDragStart({ active }: DragStartEvent) {
    dragStart.current = columns;
    setActiveId(String(active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findDay(String(active.id));
    const to = findDay(String(over.id));
    if (!from || !to || from === to) return;

    setColumns((current) => {
      const moving = current[from]!.find((item) => item.id === active.id);
      if (!moving) return current;
      const target = current[to]!;
      const overIndex = target.findIndex((item) => item.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: current[from]!.filter((item) => item.id !== active.id),
        [to]: [...target.slice(0, insertAt), moving, ...target.slice(insertAt)],
      };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const snapshot = dragStart.current ?? columns;
    dragStart.current = null;
    const itemId = String(active.id);
    const day = findDay(itemId);
    if (!over || !day) {
      setColumns(snapshot);
      return;
    }

    const items = columns[day]!;
    const from = items.findIndex((item) => item.id === itemId);
    const overIndex = items.findIndex((item) => item.id === over.id);
    const to = overIndex >= 0 ? overIndex : from;
    const reordered = arrayMove(items, from, to);

    const originalDay = findDay(itemId, snapshot);
    const originalIndex = originalDay ? snapshot[originalDay]!.findIndex((item) => item.id === itemId) : -1;
    if (originalDay === day && originalIndex === to) {
      setColumns(snapshot);
      return;
    }

    const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position);
    reordered[to] = { ...reordered[to]!, position, day_date: day };
    setColumns({ ...columns, [day]: reordered });
    setSelectedDay(day);

    const result = await updateItineraryItem(itemId, { day_date: day, position });
    if (!result.ok) {
      toast.error(result.error);
      setColumns(snapshot);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dayRoutes = useMemo<MapDayRoute[]>(
    () =>
      days.map((day, index) => ({
        id: day,
        label: `Day ${index + 1}`,
        color: dayRouteColor(index),
        stops: locatedStops(columns[day] ?? []).map((item, index, located) => ({
          id: item.id,
          label: item.place.name,
          lat: item.place.lat,
          lng: item.place.lng,
          departMode: located[index + 1]?.travel_mode ?? null,
        })),
      })),
    [days, columns],
  );

  function describe(id: UniqueIdentifier | undefined) {
    if (id === undefined) return "nowhere";
    const day = findDay(String(id));
    if (!day) return "nowhere";
    const dayName = `day ${days.indexOf(day) + 1}, ${formatDay(day)}`;
    const items = columns[day]!;
    const index = items.findIndex((item) => item.id === id);
    return index >= 0 ? `position ${index + 1} of ${items.length} in ${dayName}` : `the end of ${dayName}`;
  }

  const labelFor = (id: UniqueIdentifier) => {
    const item = allItems.find((entry) => entry.id === id);
    return item ? itemLabel(item) : "Stop";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelFor(active.id)} at ${describe(active.id)}.`,
    onDragOver: ({ active, over }) => `${labelFor(active.id)} is over ${describe(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over ? `${labelFor(active.id)} was dropped at ${describe(active.id)}.` : `${labelFor(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelFor(active.id)} was cancelled.`,
  };

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {pluralize(days.length, "day")} · {pluralize(allItems.length, "stop")}
            {canEdit ? " · Drag stops to reorder or move them between days" : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            aria-expanded={showMapOnMobile || Boolean(pinning)}
            onClick={() => setShowMapOnMobile((value) => !value)}
          >
            <MapIcon />
            {showMapOnMobile || pinning ? "Hide map" : "Map"}
          </Button>
        </div>

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To move a stop, press space or enter. Use the arrow keys to move it within a day or to another day, then press space or enter to drop it, or escape to cancel.",
            },
          }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={(event) => void onDragEnd(event)}
          onDragCancel={() => {
            setActiveId(null);
            if (dragStart.current) setColumns(dragStart.current);
            dragStart.current = null;
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {days.map((day, index) => (
              <DayColumn
                key={day}
                day={day}
                dayNumber={index + 1}
                color={dayRouteColor(index)}
                items={columns[day] ?? []}
                selected={day === selectedDay}
                canEdit={canEdit}
                destinationId={destinationId}
                listPlaces={listPlaces}
                onSelect={() => setSelectedDay(day)}
                onAdd={(subject) => void addItem(day, subject)}
                onChange={(itemId, patch) => void updateItem(itemId, patch)}
                onDelete={(itemId) => void removeItem(itemId)}
                canPin={canPin}
                center={center}
                pin={pinning?.day === day ? pinning : null}
                onPinMap={() => startPin(day)}
                onDropPin={(coords) => dropPin(coords, day)}
                onLocate={(coords) => setMapFocus({ ...coords, nonce: Date.now() })}
                onCancelPin={() => setPinning(null)}
                onConfirmPin={confirmPin}
              />
            ))}
          </div>
          <DragOverlay>{activeItem ? <ItemDragPreview item={activeItem} /> : null}</DragOverlay>
        </DndContext>
      </div>

      <aside
        className={cn(
          "order-first lg:sticky lg:top-32 lg:order-none lg:block",
          showMapOnMobile || pinning ? "max-lg:block" : "max-lg:hidden",
        )}
      >
        <DayMap
          routes={dayRoutes}
          selectedRouteId={selectedDay}
          center={center}
          focus={mapFocus}
          title="Trip map"
          pinMode={Boolean(pinning)}
          pendingPin={pinning?.lat != null && pinning.lng != null ? { lat: pinning.lat, lng: pinning.lng } : null}
          onPin={dropPin}
        />
      </aside>
    </div>
  );
}

function DayColumn({
  day,
  dayNumber,
  color,
  items,
  selected,
  canEdit,
  destinationId,
  listPlaces,
  onSelect,
  onAdd,
  onChange,
  onDelete,
  canPin,
  center,
  pin,
  onPinMap,
  onDropPin,
  onLocate,
  onCancelPin,
  onConfirmPin,
}: {
  day: string;
  dayNumber: number;
  color: string;
  items: ItineraryItem[];
  selected: boolean;
  canEdit: boolean;
  destinationId: string | null;
  listPlaces: PlaceSummary[];
  onSelect: () => void;
  onAdd: (subject: { place: PlaceSummary } | { title: string }) => void;
  onChange: (itemId: string, patch: ItineraryPatch) => void;
  onDelete: (itemId: string) => void;
  canPin: boolean;
  center: { lat: number; lng: number } | null;
  pin: MapPinDraft | null;
  onPinMap: () => void;
  onDropPin: (coords: { lat: number; lng: number }) => void;
  onLocate: (coords: { lat: number; lng: number }) => void;
  onCancelPin: () => void;
  onConfirmPin: (name: string) => Promise<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day, disabled: !canEdit });
  const [adding, setAdding] = useState<"place" | "activity" | null>(null);
  const [activity, setActivity] = useState("");
  const [travelMinutesByItem, setTravelMinutesByItem] = useState<Record<string, number>>({});
  const minutes = items.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);
  const travelMinutes = Object.values(travelMinutesByItem).reduce((sum, value) => sum + value, 0);
  const reportTravel = useCallback((itemId: string, value: number | null) => {
    setTravelMinutesByItem((current) => {
      if (value == null) {
        if (!(itemId in current)) return current;
        const next = { ...current };
        delete next[itemId];
        return next;
      }
      if (current[itemId] === value) return current;
      return { ...current, [itemId]: value };
    });
  }, []);

  return (
    <section
      aria-label={`Day ${dayNumber}, ${formatDay(day)}`}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/40 p-2.5 ring-1 ring-transparent transition-colors",
        selected && "ring-orange-300",
        isOver && "bg-orange-50 dark:bg-orange-500/10",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex items-baseline justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted"
      >
        <span className="flex items-start gap-2">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <span>
            <span className="block text-sm font-semibold">Day {dayNumber}</span>
            <span className="block text-xs text-muted-foreground">{formatDay(day)}</span>
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {pluralize(items.length, "stop")}
          {minutes ? ` · ${formatDuration(minutes)}` : ""}
          {travelMinutes ? ` · ${formatDuration(travelMinutes)} travel` : ""}
        </span>
      </button>

      <SortableContext id={day} items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
          {items.length === 0 ? (
            <li className="flex min-h-16 items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs text-muted-foreground">
              {canEdit ? "Nothing planned. Add a place or drop one here." : "Nothing planned."}
            </li>
          ) : (
            items.map((item, index) => {
              const from = previousLocated(items, index);
              return (
              <Fragment key={item.id}>
                {from && hasCoordinates(item) ? (
                  <TravelGap
                    from={from}
                    to={item}
                    mode={item.travel_mode}
                    onMode={(mode) => onChange(item.id, { travel_mode: mode })}
                    onMinutes={reportTravel}
                  />
                ) : null}
                <ItineraryItemCard
                  item={item}
                  index={index}
                  canEdit={canEdit}
                  onChange={(patch) => onChange(item.id, patch)}
                  onDelete={() => onDelete(item.id)}
                />
              </Fragment>
              );
            })
          )}
        </ul>
      </SortableContext>

      {canEdit ? (
        adding === "place" ? (
          <PlacePicker
            destinationId={destinationId}
            center={center}
            excludeIds={items.flatMap((item) => (item.place ? [item.place.id] : []))}
            listPlaces={listPlaces}
            onPick={(place) => {
              onCancelPin();
              onAdd({ place });
              setAdding(null);
            }}
            onClose={() => {
              onCancelPin();
              setAdding(null);
            }}
            onPinMap={canPin ? onPinMap : undefined}
            onDropPin={canPin ? onDropPin : undefined}
            onLocate={canPin ? onLocate : undefined}
            pin={pin}
            onCancelPin={onCancelPin}
            onConfirmPin={async (name) => {
              if (await onConfirmPin(name)) setAdding(null);
            }}
          />
        ) : adding === "activity" ? (
          <form
            className="flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const title = activity.trim();
              if (!title) return;
              onAdd({ title });
              setActivity("");
              setAdding(null);
            }}
          >
            <input
              autoFocus
              value={activity}
              onChange={(event) => setActivity(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setAdding(null)}
              maxLength={200}
              placeholder="e.g. Check in, Train to Sintra"
              aria-label="Activity name"
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="sm" className="h-8">
              Add
            </Button>
          </form>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAdding("place")}>
              <MapPin />
              Add place
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAdding("activity")}>
              <PenLine />
              Activity
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}
