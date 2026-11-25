"use client";

import { Check, ExternalLink, Link2, MapPin, Paperclip, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  deleteAttachmentFile,
  uploadAttachmentFile,
  validateAttachment,
} from "@/components/trips/overview/reservation-block";
import { CATEGORY_LABELS } from "@/components/trips/place-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlaceDetail } from "@/lib/data/catalog";
import { formatTime } from "@/lib/format";
import type { PlaceListItem } from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

export function PlaceEntry({
  item,
  detail,
  canEdit,
  tripId,
  blockId,
  lists,
  handle,
  onChange,
  onRemove,
  onMove,
}: {
  item: PlaceListItem;
  detail?: PlaceDetail;
  canEdit: boolean;
  tripId: string;
  blockId: string;
  lists: { id: string; title: string }[];
  handle: ReactNode;
  onChange: (next: PlaceListItem, mode?: "now" | "debounced") => void;
  onRemove: () => void;
  onMove: (listId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const point =
    detail && Number.isFinite(detail.lat) && Number.isFinite(detail.lng) && !(detail.lat === 0 && detail.lng === 0)
      ? `${detail.lat},${detail.lng}`
      : encodeURIComponent(item.text);
  const viewUrl = `https://www.google.com/maps/search/?api=1&query=${point}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point}`;

  function addLink() {
    const url = linkDraft.trim();
    if (!url) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      toast.error("Enter a full link, including https://");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      toast.error("Links need to start with http:// or https://");
      return;
    }
    onChange({ ...item, links: [...(item.links ?? []), { id: crypto.randomUUID(), url: parsed.toString() }] });
    setLinkDraft("");
  }

  async function attach(file: File) {
    const invalid = validateAttachment(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setUploading(true);
    const result = await uploadAttachmentFile(tripId, blockId, file);
    setUploading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (item.attachment_path) void deleteAttachmentFile(item.attachment_path);
    onChange({ ...item, attachment_path: result.path, attachment_name: result.name });
  }

  return (
    <div className={cn("rounded-md px-1", item.visited && "opacity-70")}>
      <div className="group flex min-h-9 items-center gap-1.5">
        {handle}
        <MapPin className="size-4 shrink-0 text-orange-600" aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          <span className={cn("truncate", item.visited && "text-muted-foreground line-through")}>{item.text}</span>
          {item.visited ? <Check className="size-3.5 shrink-0 text-orange-600" aria-label="Visited" /> : null}
        </button>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${item.text}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
            >
              <span className="text-base leading-none">⋯</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onChange({ ...item, visited: !item.visited })}>
                {item.visited ? "Mark as not visited" : "Mark as visited"}
              </DropdownMenuItem>
              {lists.map((list) => (
                <DropdownMenuItem key={list.id} onClick={() => onMove(list.id)}>
                  Move to {list.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {canEdit ? <RemoveButton label={item.text || "place"} onClick={onRemove} /> : null}
      </div>

      {open ? (
        <div className="mb-2 ml-7 flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-sm">
          {canEdit ? (
            <button
              type="button"
              onClick={() => onChange({ ...item, visited: !item.visited })}
              className="flex w-fit items-center gap-2 rounded-full bg-background px-3 py-1 text-xs ring-1 ring-foreground/10"
            >
              <Check className={cn("size-3.5", item.visited ? "text-orange-600" : "text-muted-foreground")} />
              {item.visited ? "Visited" : "Mark as visited"}
            </button>
          ) : item.visited ? (
            <p className="text-xs text-muted-foreground">Visited</p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={item.notes ?? ""}
              disabled={!canEdit}
              onChange={(event) => onChange({ ...item, notes: event.target.value }, "debounced")}
              placeholder="Add notes, links, etc"
              maxLength={2000}
              rows={2}
              className="rounded-md bg-background px-2 py-1.5 text-sm outline-none ring-1 ring-foreground/10 focus-visible:ring-ring"
            />
          </label>
          <ul className="flex flex-col gap-1">
            {(item.links ?? []).map((link) => (
              <li key={link.id} className="flex items-center gap-2">
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-orange-700 underline">
                  {link.url}
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => onChange({ ...item, links: item.links?.filter((entry) => entry.id !== link.id) })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addLink();
              }}
            >
              <input
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                placeholder="https://"
                aria-label="Add a link"
                className="h-8 min-w-0 flex-1 rounded-md bg-background px-2 text-sm outline-none ring-1 ring-foreground/10"
              />
              <button type="submit" className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-background">
                <Plus className="size-3.5" />
                Link
              </button>
            </form>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Time</span>
              <input
                type="time"
                value={item.time ?? ""}
                disabled={!canEdit}
                onChange={(event) => onChange({ ...item, time: event.target.value || undefined })}
                className="h-8 rounded-md bg-background px-2 text-sm outline-none ring-1 ring-foreground/10"
              />
              {item.time ? <span className="text-xs text-muted-foreground">{formatTime(item.time)}</span> : null}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Cost</span>
              <input
                value={item.cost ?? ""}
                disabled={!canEdit}
                onChange={(event) => onChange({ ...item, cost: event.target.value }, "debounced")}
                placeholder="Add cost"
                maxLength={40}
                className="h-8 rounded-md bg-background px-2 text-sm outline-none ring-1 ring-foreground/10"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <textarea
              value={item.description ?? ""}
              disabled={!canEdit}
              onChange={(event) => onChange({ ...item, description: event.target.value }, "debounced")}
              placeholder="Add a description"
              maxLength={2000}
              rows={2}
              className="rounded-md bg-background px-2 py-1.5 text-sm outline-none ring-1 ring-foreground/10"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-background px-2 text-xs ring-1 ring-foreground/10">
                <Paperclip className="size-3.5" aria-hidden />
                {uploading ? "Attaching…" : "Attach"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void attach(file);
                  }}
                />
              </label>
            ) : null}
            {item.attachment_name ? <span className="text-xs text-muted-foreground">{item.attachment_name}</span> : null}
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">About</span>
            {detail ? <span>{CATEGORY_LABELS[detail.category]}</span> : null}
            {detail?.address ? <span>{detail.address}</span> : null}
            {detail?.description ? <p className="whitespace-pre-wrap">{detail.description}</p> : null}
            {!detail?.address && !detail?.description ? <span>No extra details saved for this place.</span> : null}
          </div>

          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <a href={viewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-orange-700">
              View on maps
              <ExternalLink className="size-3" aria-hidden />
            </a>
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-orange-700">
              Directions
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
    >
      <X className="size-3.5" />
    </button>
  );
}
