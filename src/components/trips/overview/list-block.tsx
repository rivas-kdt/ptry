"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CircleCheck, GripVertical, MapPin, NotebookPen, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { BlockContext } from "@/components/trips/overview/overview-board";
import { PlaceEntry } from "@/components/trips/overview/place-entry";
import { PlacePicker } from "@/components/trips/place-picker";
import { Button } from "@/components/ui/button";
import type { PlaceDetail } from "@/lib/data/catalog";
import type { CheckItem, ListContent, ListItem } from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

export function ListBlockBody({
  blockId,
  content,
  context,
  places,
  lists,
  onChange,
  onMove,
}: {
  blockId: string;
  content: ListContent;
  context: BlockContext;
  places: Record<string, PlaceDetail>;
  lists: { id: string; title: string }[];
  onChange: (content: ListContent, mode: "now" | "debounced") => void;
  onMove: (item: ListItem, listId: string) => void;
}) {
  const [placePicker, setPlacePicker] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { items } = content;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function setItems(next: ListItem[], mode: "now" | "debounced" = "now") {
    onChange({ items: next }, mode);
  }

  function replace(id: string, next: ListItem, mode: "now" | "debounced" = "now") {
    setItems(
      items.map((item) => (item.id === id ? next : item)),
      mode,
    );
  }

  function addItem(item: ListItem) {
    setItems([...items, item]);
    if (item.kind !== "place") setFocusId(item.id);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    setItems(arrayMove(items, from, to));
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && !context.canEdit ? (
        <p className="text-sm text-muted-foreground">This list is empty.</p>
      ) : null}

      <DndContext id={`${blockId}-items`} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {items.map((item) =>
              item.kind === "checklist" ? (
                <SortableItem key={item.id} id={item.id} canEdit={context.canEdit}>
                  {(handle) => (
                    <ChecklistBlock
                      item={item}
                      canEdit={context.canEdit}
                      autoFocusTitle={item.id === focusId}
                      handle={handle}
                      onFocused={() => setFocusId(null)}
                      onChange={(next, mode) => replace(item.id, next, mode)}
                      onRemove={() => setItems(items.filter((entry) => entry.id !== item.id))}
                      lists={lists}
                      onMove={(listId) => onMove(item, listId)}
                    />
                  )}
                </SortableItem>
              ) : item.kind === "place" ? (
                <SortableItem key={item.id} id={item.id} canEdit={context.canEdit}>
                  {(handle) => (
                    <PlaceEntry
                      item={item}
                      detail={item.place_id ? places[item.place_id] : undefined}
                      canEdit={context.canEdit}
                      tripId={context.tripId}
                      blockId={blockId}
                      lists={lists}
                      handle={handle}
                      onChange={(next, mode) => replace(item.id, next, mode)}
                      onRemove={() => setItems(items.filter((entry) => entry.id !== item.id))}
                      onMove={(listId) => onMove(item, listId)}
                    />
                  )}
                </SortableItem>
              ) : (
                <SortableItem key={item.id} id={item.id} canEdit={context.canEdit}>
                  {(handle) => (
                    <EntryRow
                      item={item}
                      canEdit={context.canEdit}
                      autoFocus={item.id === focusId}
                      handle={handle}
                      lists={lists}
                      onFocused={() => setFocusId(null)}
                      onChange={(patch, mode) => replace(item.id, { ...item, ...patch }, mode)}
                      onRemove={() => setItems(items.filter((entry) => entry.id !== item.id))}
                      onMove={(listId) => onMove(item, listId)}
                    />
                  )}
                </SortableItem>
              ),
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {context.canEdit ? (
        <div className="flex flex-col gap-2">
          {placePicker ? (
            <PlacePicker
              destinationId={context.destinationId}
              center={context.center}
              enablePin={Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)}
              excludeIds={items.flatMap((item) => (item.kind === "place" && item.place_id ? [item.place_id] : []))}
              onPick={(place) => {
                addItem({ id: crypto.randomUUID(), kind: "place", text: place.name, place_id: place.id });
                setPlacePicker(false);
              }}
              onClose={() => setPlacePicker(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed p-2">
              <span className="flex items-center gap-1 px-1 text-sm font-medium text-muted-foreground">
                <Plus className="size-4" aria-hidden />
                Add
              </span>
              <Button variant="outline" size="sm" onClick={() => addItem({ id: crypto.randomUUID(), kind: "note", text: "" })}>
                <NotebookPen />
                Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPlacePicker(true)}>
                <MapPin />
                Place
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addItem({ id: crypto.randomUUID(), kind: "checklist", title: "", items: [] })}
              >
                <CircleCheck />
                Checklist
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SortableItem({
  id,
  canEdit,
  children,
}: {
  id: string;
  canEdit: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEdit,
  });
  const handle = canEdit ? (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label="Hold to rearrange"
      {...attributes}
      {...listeners}
      className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      {children(handle)}
    </li>
  );
}

function EntryRow({
  item,
  canEdit,
  autoFocus,
  handle,
  lists,
  onFocused,
  onChange,
  onRemove,
  onMove,
}: {
  item: Extract<ListItem, { kind: "note" }>;
  canEdit: boolean;
  autoFocus: boolean;
  handle: ReactNode;
  lists: { id: string; title: string }[];
  onFocused: () => void;
  onChange: (patch: { text: string }, mode?: "now" | "debounced") => void;
  onRemove: () => void;
  onMove: (listId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    onFocused();
  }, [autoFocus, onFocused]);

  return (
    <div className="group flex min-h-9 items-center gap-1.5 rounded-md px-1 hover:bg-muted/50">
      {handle}
      {canEdit ? (
        <input
          ref={input}
          value={item.text}
          onChange={(event) => onChange({ text: event.target.value }, "debounced")}
          onBlur={() => {
            if (!item.text.trim()) onRemove();
          }}
          maxLength={300}
          placeholder="Write a note"
          aria-label="Note"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <span className="min-w-0 flex-1 py-1.5 text-sm">{item.text}</span>
      )}
      {canEdit && lists.length > 0 ? <MoveMenu label={item.text || "note"} lists={lists} onMove={onMove} /> : null}
      {canEdit ? <RemoveButton label={item.text || "item"} onClick={onRemove} /> : null}
    </div>
  );
}

function ChecklistBlock({
  item,
  canEdit,
  autoFocusTitle,
  handle,
  onFocused,
  onChange,
  onRemove,
  lists,
  onMove,
}: {
  item: Extract<ListItem, { kind: "checklist" }>;
  canEdit: boolean;
  autoFocusTitle: boolean;
  handle: ReactNode;
  onFocused: () => void;
  onChange: (item: Extract<ListItem, { kind: "checklist" }>, mode?: "now" | "debounced") => void;
  onRemove: () => void;
  lists: { id: string; title: string }[];
  onMove: (listId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const done = item.items.filter((entry) => entry.checked).length;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!autoFocusTitle) return;
    titleInput.current?.focus();
    titleInput.current?.select();
    onFocused();
  }, [autoFocusTitle, onFocused]);

  function setEntries(entries: CheckItem[], mode: "now" | "debounced" = "now") {
    onChange({ ...item, items: entries }, mode);
  }

  function addEntry(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setEntries([...item.items, { id: crypto.randomUUID(), text, checked: false }]);
    setDraft("");
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = item.items.findIndex((entry) => entry.id === active.id);
    const to = item.items.findIndex((entry) => entry.id === over.id);
    if (from < 0 || to < 0) return;
    setEntries(arrayMove(item.items, from, to));
  }

  return (
    <div className="rounded-xl bg-muted/40 ring-1 ring-foreground/10">
      <div className="group flex items-center gap-1 py-1.5 pr-1.5 pl-1">
        {handle}
        {canEdit ? (
          <input
            ref={titleInput}
            value={item.title}
            onChange={(event) => onChange({ ...item, title: event.target.value }, "debounced")}
            maxLength={120}
            placeholder="Checklist"
            aria-label="Checklist title"
            className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus-visible:bg-muted/60"
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{item.title || "Checklist"}</h3>
        )}
        {canEdit && lists.length > 0 ? <MoveMenu label={item.title || "checklist"} lists={lists} onMove={onMove} /> : null}
        {canEdit ? <RemoveButton label={item.title || "checklist"} onClick={onRemove} /> : null}
      </div>

      {item.items.length > 0 ? (
        <p className="px-3 pb-1 text-xs text-muted-foreground">
          {done} of {item.items.length} done
        </p>
      ) : null}

      <DndContext id={`${item.id}-checks`} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={item.items.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col px-1.5 pb-1">
            {item.items.map((entry) => (
              <SortableItem key={entry.id} id={entry.id} canEdit={canEdit}>
                {(rowHandle) => (
                  <CheckRow
                    entry={entry}
                    canEdit={canEdit}
                    handle={rowHandle}
                    onChange={(patch, mode) =>
                      setEntries(
                        item.items.map((current) => (current.id === entry.id ? { ...current, ...patch } : current)),
                        mode,
                      )
                    }
                    onRemove={() => setEntries(item.items.filter((current) => current.id !== entry.id))}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {canEdit ? (
        <form className="flex items-center gap-2 px-3 pb-2.5" onSubmit={addEntry}>
          <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add an item"
            maxLength={300}
            aria-label={`New item in ${item.title || "checklist"}`}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
      ) : null}
    </div>
  );
}

function CheckRow({
  entry,
  canEdit,
  handle,
  onChange,
  onRemove,
}: {
  entry: CheckItem;
  canEdit: boolean;
  handle: ReactNode;
  onChange: (patch: Partial<CheckItem>, mode?: "now" | "debounced") => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex min-h-9 items-center gap-1.5 rounded-md px-1 hover:bg-muted/50">
      {handle}
      <input
        type="checkbox"
        checked={entry.checked}
        disabled={!canEdit}
        onChange={(event) => onChange({ checked: event.target.checked })}
        aria-label={entry.text || "Item"}
        className="size-4 shrink-0 accent-orange-600"
      />
      {canEdit ? (
        <input
          value={entry.text}
          onChange={(event) => onChange({ text: event.target.value }, "debounced")}
          onBlur={() => {
            if (!entry.text.trim()) onRemove();
          }}
          maxLength={300}
          aria-label="Item text"
          className={cn(
            "h-8 min-w-0 flex-1 bg-transparent text-sm outline-none",
            entry.checked && "text-muted-foreground line-through",
          )}
        />
      ) : (
        <span className={cn("min-w-0 flex-1 py-1.5 text-sm", entry.checked && "text-muted-foreground line-through")}>
          {entry.text}
        </span>
      )}
      {canEdit ? <RemoveButton label={entry.text || "item"} onClick={onRemove} /> : null}
    </div>
  );
}

function MoveMenu({
  label,
  lists,
  onMove,
}: {
  label: string;
  lists: { id: string; title: string }[];
  onMove: (listId: string) => void;
}) {
  return (
    <details className="relative">
      <summary className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <span className="sr-only">Move {label}</span>
        Move
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => onMove(list.id)}
            className="block w-full truncate rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {list.title}
          </button>
        ))}
      </div>
    </details>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
    >
      <X className="size-3.5" />
    </button>
  );
}
