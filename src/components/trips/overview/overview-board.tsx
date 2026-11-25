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
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ListChecks, NotebookPen, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createBlock, deleteBlock, updateBlock } from "@/app/(app)/trips/block-actions";
import { BlockCard } from "@/components/trips/overview/block-card";
import { ListBlockBody } from "@/components/trips/overview/list-block";
import { NoteBlockBody } from "@/components/trips/overview/note-block";
import {
  AttachmentsDialog,
  attachmentsFromBlocks,
  deleteAttachmentFile,
  KIND_META,
  ReservationBlockBody,
  ReservationsDialog,
  ReservationsHub,
  uploadAttachmentFile,
  validateAttachment,
  type ReservationNavId,
  type TripAttachment,
} from "@/components/trips/overview/reservation-block";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaceDetail } from "@/lib/data/catalog";
import {
  DEFAULT_TITLES,
  emptyContent,
  isStandaloneAttachment,
  positionBetween,
  type BlockContent,
  type ListItem,
  type ReservationContent,
  type ReservationKind,
  type TripBlock,
} from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

type Patch = { title?: string | null; collapsed?: boolean; position?: number; content?: BlockContent };

const SAVE_DELAY_MS = 700;

export type BlockContext = {
  tripId: string;
  destinationId: string | null;
  center: { lat: number; lng: number } | null;
  canEdit: boolean;
};

export function OverviewBoard({
  tripId,
  destinationId,
  center,
  canEdit,
  initialBlocks,
  places,
}: BlockContext & { initialBlocks: TripBlock[]; places: Record<string, PlaceDetail> }) {
  const dndId = useId();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState<ReservationNavId | null>(null);
  const pending = useRef(new Map<string, { patch: Patch; timer: ReturnType<typeof setTimeout> }>());

  const persist = useCallback(async (blockId: string, patch: Patch) => {
    const result = await updateBlock(blockId, patch);
    if (!result.ok) toast.error(result.error);
    return result.ok;
  }, []);

  const flush = useCallback(
    (blockId?: string) => {
      for (const [id, entry] of pending.current) {
        if (blockId && id !== blockId) continue;
        clearTimeout(entry.timer);
        pending.current.delete(id);
        void persist(id, entry.patch);
      }
    },
    [persist],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  /** Applies a change locally right away and saves it, debounced for typing. */
  const change = useCallback(
    (blockId: string, patch: Patch, mode: "now" | "debounced" = "now") => {
      setBlocks((current) =>
        current.map((block) => (block.id === blockId ? ({ ...block, ...patch } as TripBlock) : block)),
      );
      // Viewers can still expand and collapse locally; nothing is saved for them.
      if (!canEdit) return;
      const queued = pending.current.get(blockId);
      if (queued) clearTimeout(queued.timer);
      const merged = { ...queued?.patch, ...patch };
      if (mode === "now") {
        pending.current.delete(blockId);
        void persist(blockId, merged);
      } else {
        pending.current.set(blockId, {
          patch: merged,
          timer: setTimeout(() => flush(blockId), SAVE_DELAY_MS),
        });
      }
    },
    [canEdit, flush, persist],
  );

  async function addBlock(type: "note" | "list") {
    const block = {
      id: crypto.randomUUID(),
      type,
      title: DEFAULT_TITLES[type],
      position: positionBetween(blocks.at(-1)?.position, undefined),
      collapsed: false,
      content: emptyContent(type),
    } as TripBlock;
    setBlocks((current) => [...current, block]);
    setNewBlockId(block.id);

    const result = await createBlock({ ...block, tripId });
    if (!result.ok) {
      toast.error(result.error);
      setBlocks((current) => current.filter((b) => b.id !== block.id));
    }
  }

  async function addReservation(kind: ReservationKind) {
    const block = {
      id: crypto.randomUUID(),
      type: "reservation" as const,
      title: KIND_META[kind].label,
      position: positionBetween(blocks.at(-1)?.position, undefined),
      collapsed: false,
      content: { ...emptyContent("reservation"), kind } as ReservationContent,
    };
    setBlocks((current) => [...current, block]);
    setNewBlockId(block.id);

    const result = await createBlock({ ...block, tripId });
    if (!result.ok) {
      toast.error(result.error);
      setBlocks((current) => current.filter((item) => item.id !== block.id));
    }
  }

  function moveListItem(fromId: string, item: ListItem, toId: string) {
    if (fromId === toId) return;
    let nextBlocks: TripBlock[] = [];
    setBlocks((current) => {
      nextBlocks = current.map((block) => {
        if (block.type !== "list") return block;
        if (block.id === fromId) {
          return { ...block, content: { items: block.content.items.filter((entry) => entry.id !== item.id) } };
        }
        if (block.id === toId) {
          return { ...block, content: { items: [...block.content.items, item] } };
        }
        return block;
      });
      return nextBlocks;
    });
    for (const block of nextBlocks) {
      if (block.type === "list" && (block.id === fromId || block.id === toId)) {
        void persist(block.id, { content: block.content });
      }
    }
  }

  async function removeBlock(blockId: string) {
    const snapshot = blocks;
    const entry = pending.current.get(blockId);
    if (entry) {
      clearTimeout(entry.timer);
      pending.current.delete(blockId);
    }
    setBlocks((current) => current.filter((b) => b.id !== blockId));
    const result = await deleteBlock(blockId);
    if (!result.ok) {
      toast.error(result.error);
      setBlocks(snapshot);
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;

    const snapshot = blocks;
    const reordered = arrayMove(blocks, from, to);
    const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position);
    reordered[to] = { ...reordered[to]!, position };
    setBlocks(reordered);

    const ok = await persist(String(active.id), { position });
    if (!ok) setBlocks(snapshot);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function uploadTripAttachment(file: File) {
    const invalid = validateAttachment(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const id = crypto.randomUUID();
    const uploaded = await uploadAttachmentFile(tripId, id, file);
    if ("error" in uploaded) {
      toast.error(uploaded.error);
      return;
    }
    const block = {
      id,
      type: "reservation" as const,
      title: uploaded.name,
      position: positionBetween(blocks.at(-1)?.position, undefined),
      collapsed: true,
      content: {
        kind: "other" as const,
        attachment_path: uploaded.path,
        attachment_name: uploaded.name,
      },
    };
    setBlocks((current) => [...current, block]);
    const result = await createBlock({ ...block, tripId });
    if (!result.ok) {
      toast.error(result.error);
      setBlocks((current) => current.filter((item) => item.id !== id));
      await deleteAttachmentFile(uploaded.path);
    }
  }

  async function removeTripAttachment(file: TripAttachment) {
    if (file.standalone) {
      await removeBlock(file.blockId);
      return;
    }
    const error = await deleteAttachmentFile(file.path);
    if (error) {
      toast.error(error);
      return;
    }
    const block = blocks.find((item) => item.id === file.blockId);
    if (block?.type !== "reservation") return;
    change(file.blockId, {
      content: { ...block.content, attachment_path: undefined, attachment_name: undefined },
    });
  }

  const context: BlockContext = { tripId, destinationId, center, canEdit };
  const lists = blocks.flatMap((block) =>
    block.type === "list" ? [{ id: block.id, title: block.title?.trim() || "List" }] : [],
  );
  const hubCounts = useMemo(() => {
    const counts: Partial<Record<ReservationNavId, number>> = {};
    for (const block of blocks) {
      if (block.type !== "reservation") continue;
      if (!isStandaloneAttachment(block)) {
        counts[block.content.kind] = (counts[block.content.kind] ?? 0) + 1;
      }
      if (block.content.attachment_path) {
        counts.attachment = (counts.attachment ?? 0) + 1;
      }
    }
    return counts;
  }, [blocks]);
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => block.type !== "reservation"),
    [blocks],
  );
  const attachmentFiles = useMemo(() => attachmentsFromBlocks(blocks), [blocks]);
  const openKind = hubOpen && hubOpen !== "attachment" ? hubOpen : null;
  const kindReservations = useMemo(() => {
    if (!openKind) return [];
    return blocks.filter(
      (block): block is Extract<TripBlock, { type: "reservation" }> =>
        block.type === "reservation" &&
        !isStandaloneAttachment(block) &&
        block.content.kind === openKind,
    );
  }, [blocks, openKind]);

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-6">
        <ReservationsHub selected={hubOpen} counts={hubCounts} onSelect={setHubOpen} />
        <AttachmentsDialog
          open={hubOpen === "attachment"}
          onOpenChange={(open) => setHubOpen(open ? "attachment" : null)}
          canEdit={canEdit}
          files={attachmentFiles}
          onUpload={uploadTripAttachment}
          onRemove={removeTripAttachment}
        />
        {openKind ? (
          <ReservationsDialog
            open
            onOpenChange={(open) => {
              if (!open) setHubOpen(null);
            }}
            kind={openKind}
            reservations={kindReservations}
            canEdit={canEdit}
            newBlockId={newBlockId}
            context={context}
            onAdd={() => void addReservation(openKind)}
            onTitleChange={(blockId, title) => change(blockId, { title }, "debounced")}
            onTitleCommit={(blockId) => flush(blockId)}
            onDelete={(blockId) => void removeBlock(blockId)}
            onContentChange={(blockId, content, mode) => change(blockId, { content }, mode)}
          />
        ) : null}

        {visibleBlocks.length > 0 ? (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={visibleBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-4">
                {visibleBlocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    canEdit={canEdit}
                    autoFocusTitle={block.id === newBlockId}
                    onTitleChange={(title) => change(block.id, { title }, "debounced")}
                    onTitleCommit={() => flush(block.id)}
                    onToggleCollapsed={() => change(block.id, { collapsed: !block.collapsed })}
                    onDelete={() => void removeBlock(block.id)}
                  >
                    <BlockBody
                      block={block}
                      context={context}
                      places={places}
                      lists={lists.filter((list) => list.id !== block.id)}
                      change={change}
                      onMoveItem={moveListItem}
                    />
                  </BlockCard>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : null}

      </div>

      {canEdit ? (
        <AddBlockFab onAdd={(type) => void addBlock(type)} />
      ) : null}
    </div>
  );
}

function AddBlockFab({ onAdd }: { onAdd: (type: "note" | "list") => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-5 z-40 sm:right-6">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-lg"
              className="size-12 rounded-full shadow-lg"
              aria-label="Add note or list"
            />
          }
        >
          <Plus className={cn("size-5 transition-transform", open && "rotate-45")} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-40">
          <DropdownMenuItem onClick={() => onAdd("note")}>
            <NotebookPen />
            Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("list")}>
            <ListChecks />
            List
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BlockBody({
  block,
  context,
  places,
  lists,
  change,
  onMoveItem,
}: {
  block: TripBlock;
  context: BlockContext;
  places: Record<string, PlaceDetail>;
  lists: { id: string; title: string }[];
  change: (blockId: string, patch: Patch, mode?: "now" | "debounced") => void;
  onMoveItem: (fromId: string, item: ListItem, toId: string) => void;
}) {
  switch (block.type) {
    case "note":
      return (
        <NoteBlockBody
          content={block.content}
          canEdit={context.canEdit}
          onChange={(content) => change(block.id, { content }, "debounced")}
        />
      );
    case "list":
      return (
        <ListBlockBody
          blockId={block.id}
          content={block.content}
          context={context}
          places={places}
          lists={lists}
          onChange={(content, mode) => change(block.id, { content }, mode)}
          onMove={(item, listId) => onMoveItem(block.id, item, listId)}
        />
      );
    case "reservation":
      return (
        <ReservationBlockBody
          blockId={block.id}
          content={block.content}
          context={context}
          onChange={(content, mode) => change(block.id, { content }, mode)}
        />
      );
  }
}
