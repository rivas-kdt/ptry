"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, ListChecks, MoreHorizontal, NotebookPen, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KIND_META } from "@/components/trips/overview/reservation-block";
import type { TripBlock } from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

const TYPE_ICONS = { note: NotebookPen, list: ListChecks };
const TYPE_LABELS = { note: "Note", list: "List", reservation: "Reservation" };

export function BlockCard({
  block,
  canEdit,
  autoFocusTitle,
  onTitleChange,
  onTitleCommit,
  onToggleCollapsed,
  onDelete,
  children,
}: {
  block: TripBlock;
  canEdit: boolean;
  autoFocusTitle: boolean;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  onToggleCollapsed: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: !canEdit });
  const Icon = block.type === "reservation" ? KIND_META[block.content.kind].icon : TYPE_ICONS[block.type];
  const typeLabel =
    block.type === "reservation" ? KIND_META[block.content.kind].label : TYPE_LABELS[block.type];
  const bodyId = `block-${block.id}-body`;
  const title = block.title ?? "";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10",
        isDragging && "z-10 shadow-lg ring-orange-300",
      )}
    >
      <div className="flex items-center gap-1 py-2 pr-2 pl-1 sm:pl-2">
        {canEdit ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${title || typeLabel}`}
            className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!block.collapsed}
          aria-controls={bodyId}
          aria-label={block.collapsed ? "Expand" : "Collapse"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ChevronDown className={cn("size-4 transition-transform", block.collapsed && "-rotate-90")} />
        </button>
        {block.type !== "list" ? (
          <Icon className="mx-1 size-4 shrink-0 text-orange-600" aria-hidden />
        ) : null}
        {canEdit ? (
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            autoFocus={autoFocusTitle}
            onFocus={(event) => autoFocusTitle && event.currentTarget.select()}
            maxLength={120}
            placeholder={typeLabel}
            aria-label={`${typeLabel} title`}
            className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1 text-base font-semibold outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus-visible:bg-muted/60"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate px-1 text-base font-semibold">
            {title || typeLabel}
          </h2>
        )}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Block actions"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete {typeLabel.toLowerCase()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {block.collapsed ? null : (
        <div id={bodyId} className="px-4 pb-4 sm:px-5">
          {children}
        </div>
      )}
    </li>
  );
}
