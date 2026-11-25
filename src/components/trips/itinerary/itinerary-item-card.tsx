"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical, Hourglass, MapPin, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABELS } from "@/components/trips/place-picker";
import type { ItineraryPatch } from "@/app/(app)/trips/itinerary-actions";
import type { ItineraryItem } from "@/lib/data/trip";
import { formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];

export function itemLabel(item: ItineraryItem) {
  return item.place?.name ?? item.title ?? "Untitled";
}

export function ItineraryItemCard({
  item,
  index,
  canEdit,
  onChange,
  onDelete,
}: {
  item: ItineraryItem;
  index: number;
  canEdit: boolean;
  onChange: (patch: ItineraryPatch) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });
  const label = itemLabel(item);
  const editorId = `item-${item.id}-editor`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl bg-card shadow-xs ring-1 ring-foreground/10",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5 p-2">
        {canEdit ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${label}`}
            className="mt-0.5 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <span
          className={cn(
            "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            item.place ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditing((value) => !value)}
            aria-expanded={canEdit ? editing : undefined}
            aria-controls={canEdit ? editorId : undefined}
            className="block w-full text-left disabled:cursor-default"
          >
            <span className="block truncate text-sm font-medium">{label}</span>
            {item.place ? (
              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" aria-hidden />
                {CATEGORY_LABELS[item.place.category]}
                {item.place.address ? ` · ${item.place.address}` : ""}
              </span>
            ) : null}
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {item.start_time ? (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Clock className="size-3" aria-hidden />
                  {formatTime(item.start_time)}
                </span>
              ) : canEdit ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  Add time
                </span>
              ) : null}
              {item.duration_minutes ? (
                <span className="flex items-center gap-1">
                  <Hourglass className="size-3" aria-hidden />
                  {formatDuration(item.duration_minutes)}
                </span>
              ) : null}
              {item.notes ? (
                <span className="flex items-center gap-1">
                  <StickyNote className="size-3" aria-hidden />
                  Note
                </span>
              ) : null}
            </span>
          </button>
          {item.notes && !editing ? (
            <p className="mt-1.5 line-clamp-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {item.notes}
            </p>
          ) : null}
        </div>
      </div>

      {canEdit && editing ? (
        <div id={editorId} className="flex flex-col gap-2 border-t px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Start time
              <input
                type="time"
                value={item.start_time?.slice(0, 5) ?? ""}
                onChange={(event) => onChange({ start_time: event.target.value || null })}
                className="h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Duration
              <select
                value={item.duration_minutes ?? ""}
                onChange={(event) =>
                  onChange({ duration_minutes: event.target.value ? Number(event.target.value) : null })
                }
                className="h-8 rounded-md border bg-background px-1.5 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">None</option>
                {item.duration_minutes && !DURATIONS.includes(item.duration_minutes) ? (
                  <option value={item.duration_minutes}>{formatDuration(item.duration_minutes)}</option>
                ) : null}
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notes.trim() !== (item.notes ?? "")) onChange({ notes: notes.trim() || null });
              }}
              rows={2}
              maxLength={2000}
              placeholder="Tickets, tips, what to order…"
              className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ItemDragPreview({ item }: { item: ItineraryItem }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card p-2.5 text-sm font-medium shadow-lg ring-1 ring-orange-300">
      <GripVertical className="size-4 text-muted-foreground" aria-hidden />
      <span className="truncate">{itemLabel(item)}</span>
    </div>
  );
}
