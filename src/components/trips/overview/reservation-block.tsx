"use client";

import { ArrowLeftRight, BedDouble, Car, FileText, Loader2, Paperclip, Plane, Plus, TrainFront, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/app/(app)/trips/block-actions";
import type { BlockContext } from "@/components/trips/overview/overview-board";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  isStandaloneAttachment,
  type ReservationContent,
  type ReservationKind,
  type TripBlock,
} from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

export const KIND_META: Record<ReservationKind, { label: string; icon: typeof Plane; start: string; end: string }> = {
  flight: { label: "Flight", icon: Plane, start: "Departs", end: "Arrives" },
  lodging: { label: "Lodging", icon: BedDouble, start: "Check-in", end: "Check-out" },
  car: { label: "Rental car", icon: Car, start: "Pick-up", end: "Drop-off" },
  train: { label: "Train", icon: TrainFront, start: "Departs", end: "Arrives" },
  other: { label: "Other", icon: ArrowLeftRight, start: "Starts", end: "Ends" },
};

export const RESERVATION_NAV = [
  { id: "flight", label: "Flights", icon: Plane },
  { id: "lodging", label: "Lodging", icon: BedDouble },
  { id: "car", label: "Rental cars", icon: Car },
  { id: "attachment", label: "Attachment", icon: Paperclip },
  { id: "train", label: "Trains", icon: TrainFront },
  { id: "other", label: "Other", icon: ArrowLeftRight },
] as const;

export type ReservationNavId = (typeof RESERVATION_NAV)[number]["id"];

export function ReservationsHub({
  selected,
  counts,
  onSelect,
}: {
  selected: ReservationNavId | null;
  counts: Partial<Record<ReservationNavId, number>>;
  onSelect: (id: ReservationNavId) => void;
}) {
  return (
    <section className="w-full max-w-md rounded-2xl bg-card px-5 py-4 shadow-sm ring-1 ring-foreground/10">
      <h2 className="text-[15px] font-semibold tracking-tight">Reservations and attachments</h2>
      <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3.5">
        {RESERVATION_NAV.map(({ id, label, icon: Icon }) => {
          const count = counts[id] ?? 0;
          const active = selected === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg py-1 pr-1 text-left text-sm transition-colors",
                  active ? "text-orange-600" : "text-foreground hover:bg-muted/70",
                )}
              >
                <span className="relative flex size-6 shrink-0 items-center justify-center">
                  <Icon className={cn("size-[18px]", active ? "text-orange-600" : "text-muted-foreground")} aria-hidden />
                  {count > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  ) : null}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

export type TripAttachment = {
  blockId: string;
  path: string;
  name: string;
  caption: string;
  standalone: boolean;
};

export function attachmentsFromBlocks(blocks: TripBlock[]): TripAttachment[] {
  return blocks.flatMap((block) => {
    if (block.type !== "reservation" || !block.content.attachment_path) return [];
    const kind = KIND_META[block.content.kind];
    return [
      {
        blockId: block.id,
        path: block.content.attachment_path,
        name: block.content.attachment_name ?? "Attachment",
        caption: isStandaloneAttachment(block) ? "Uploaded file" : kind.label,
        standalone: isStandaloneAttachment(block),
      },
    ];
  });
}

export function validateAttachment(file: File) {
  if (!ATTACHMENT_TYPES.includes(file.type)) return "Attach a PDF or an image.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "Attachments must be 10 MB or smaller.";
  return null;
}

export async function uploadAttachmentFile(tripId: string, blockId: string, file: File) {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${tripId}/${blockId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
  if (error) {
    console.error(error);
    return { error: "Couldn't upload the attachment." as const };
  }
  return { path, name: file.name.slice(0, 120) };
}

export async function deleteAttachmentFile(path: string) {
  const { error } = await createClient().storage.from("attachments").remove([path]);
  if (error) {
    console.error(error);
    return "Couldn't remove the attachment.";
  }
  return null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** `datetime-local` values carry no zone; show them exactly as entered. */
function formatLocalDateTime(value: string) {
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

const fieldClass =
  "h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ReservationBlockBody({
  blockId,
  content,
  context,
  onChange,
}: {
  blockId: string;
  content: ReservationContent;
  context: BlockContext;
  onChange: (content: ReservationContent, mode: "now" | "debounced") => void;
}) {
  const meta = KIND_META[content.kind];
  const set = (patch: Partial<ReservationContent>, mode: "now" | "debounced" = "debounced") =>
    onChange({ ...content, ...patch }, mode);

  if (!context.canEdit) {
    return <ReservationSummary content={content} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Confirmation #
          <input
            value={content.confirmation ?? ""}
            onChange={(event) => set({ confirmation: event.target.value })}
            maxLength={80}
            placeholder="ABC123"
            className={cn(fieldClass, "font-mono uppercase text-foreground")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {meta.start}
          <input
            type="datetime-local"
            value={content.starts_at ?? ""}
            onChange={(event) => set({ starts_at: event.target.value || undefined }, "now")}
            className={cn(fieldClass, "text-foreground")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {meta.end}
          <input
            type="datetime-local"
            value={content.ends_at ?? ""}
            min={content.starts_at}
            onChange={(event) => set({ ends_at: event.target.value || undefined }, "now")}
            className={cn(fieldClass, "text-foreground")}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Details
        <textarea
          value={content.details ?? ""}
          onChange={(event) => set({ details: event.target.value })}
          maxLength={2000}
          rows={2}
          placeholder={
            content.kind === "flight"
              ? "Airline, flight number, seats…"
              : content.kind === "lodging"
                ? "Hotel name, address, room…"
                : content.kind === "car"
                  ? "Agency, vehicle, pickup location…"
                  : content.kind === "train"
                    ? "Operator, train number, seats…"
                    : "Anything worth remembering"
          }
          className="min-h-16 w-full rounded-lg border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <Attachment
        tripId={context.tripId}
        blockId={blockId}
        content={content}
        onChange={(patch) => set(patch, "now")}
      />
    </div>
  );
}

function ReservationSummary({ content }: { content: ReservationContent }) {
  const meta = KIND_META[content.kind];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-orange-600" aria-hidden />
        {meta.label}
        {content.confirmation ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs uppercase">
            {content.confirmation}
          </span>
        ) : null}
      </p>
      {content.starts_at || content.ends_at ? (
        <dl className="grid grid-cols-2 gap-2">
          {content.starts_at ? (
            <div>
              <dt className="text-xs text-muted-foreground">{meta.start}</dt>
              <dd>{formatLocalDateTime(content.starts_at)}</dd>
            </div>
          ) : null}
          {content.ends_at ? (
            <div>
              <dt className="text-xs text-muted-foreground">{meta.end}</dt>
              <dd>{formatLocalDateTime(content.ends_at)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {content.details ? <p className="whitespace-pre-wrap text-muted-foreground">{content.details}</p> : null}
      {content.attachment_path ? (
        <OpenAttachmentButton
          path={content.attachment_path}
          name={content.attachment_name ?? "Attachment"}
        />
      ) : null}
    </div>
  );
}

function OpenAttachmentButton({
  path,
  name,
}: {
  path: string;
  name: string;
}) {
  const [opening, setOpening] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="max-w-full self-start"
      disabled={opening}
      onClick={async () => {
        // Open synchronously so popup blockers allow it, then point it at the signed URL.
        const tab = window.open("", "_blank");
        setOpening(true);
        const result = await getAttachmentUrl(path);
        setOpening(false);
        if ("url" in result) {
          if (tab) {
            tab.opener = null;
            tab.location.href = result.url;
          } else {
            window.location.href = result.url;
          }
        } else {
          tab?.close();
          toast.error(result.error);
        }
      }}
    >
      {opening ? <Loader2 className="animate-spin" /> : <FileText />}
      <span className="truncate">{name}</span>
    </Button>
  );
}

function Attachment({
  tripId,
  blockId,
  content,
  onChange,
}: {
  tripId: string;
  blockId: string;
  content: ReservationContent;
  onChange: (patch: Partial<ReservationContent>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    const invalid = validateAttachment(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    const result = await uploadAttachmentFile(tripId, blockId, file);
    if ("error" in result) {
      setBusy(false);
      toast.error(result.error);
      return;
    }
    const previous = content.attachment_path;
    onChange({ attachment_path: result.path, attachment_name: result.name });
    if (previous) await deleteAttachmentFile(previous);
    setBusy(false);
  }

  async function remove() {
    if (!content.attachment_path) return;
    setBusy(true);
    const error = await deleteAttachmentFile(content.attachment_path);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    onChange({ attachment_path: undefined, attachment_name: undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={ATTACHMENT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      {content.attachment_path ? (
        <>
          <OpenAttachmentButton
            path={content.attachment_path}
            name={content.attachment_name ?? "Attachment"}
          />
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            <X />
            Remove
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
          {busy ? "Uploading…" : "Attach ticket or confirmation"}
        </Button>
      )}
    </div>
  );
}

const KIND_DIALOG: Record<ReservationKind, { title: string; description: string; empty: string; add: string; addAnother: string }> =
  {
    flight: {
      title: "Flights",
      description: "Save confirmation codes, times, and tickets.",
      empty: "No flights yet.",
      add: "Add flight",
      addAnother: "Add another flight",
    },
    lodging: {
      title: "Lodging",
      description: "Save hotels, check-in times, and confirmation codes.",
      empty: "No lodging yet.",
      add: "Add lodging",
      addAnother: "Add another lodging",
    },
    car: {
      title: "Rental cars",
      description: "Save pickup times, agencies, and confirmation codes.",
      empty: "No rental cars yet.",
      add: "Add rental car",
      addAnother: "Add another rental car",
    },
    train: {
      title: "Trains",
      description: "Save confirmation codes, times, and tickets.",
      empty: "No trains yet.",
      add: "Add train",
      addAnother: "Add another train",
    },
    other: {
      title: "Other",
      description: "Save other bookings and confirmation details.",
      empty: "No other reservations yet.",
      add: "Add reservation",
      addAnother: "Add another reservation",
    },
  };

export function ReservationsDialog({
  open,
  onOpenChange,
  kind,
  reservations,
  canEdit,
  newBlockId,
  context,
  onAdd,
  onTitleChange,
  onTitleCommit,
  onDelete,
  onContentChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ReservationKind;
  reservations: Extract<TripBlock, { type: "reservation" }>[];
  canEdit: boolean;
  newBlockId: string | null;
  context: BlockContext;
  onAdd: () => void;
  onTitleChange: (blockId: string, title: string) => void;
  onTitleCommit: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onContentChange: (blockId: string, content: ReservationContent, mode: "now" | "debounced") => void;
}) {
  const copy = KIND_DIALOG[kind];
  const Icon = KIND_META[kind].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-orange-600" aria-hidden />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {reservations.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reservations.map((block) => (
              <li key={block.id} className="rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                <div className="mb-3 flex items-center gap-1">
                  {canEdit ? (
                    <input
                      value={block.title ?? ""}
                      onChange={(event) => onTitleChange(block.id, event.target.value)}
                      onBlur={() => onTitleCommit(block.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      autoFocus={block.id === newBlockId}
                      onFocus={(event) => block.id === newBlockId && event.currentTarget.select()}
                      maxLength={120}
                      placeholder={KIND_META[kind].label}
                      aria-label={`${KIND_META[kind].label} title`}
                      className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold outline-none placeholder:text-muted-foreground hover:bg-background/80 focus-visible:bg-background"
                    />
                  ) : (
                    <h3 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">
                      {block.title || KIND_META[kind].label}
                    </h3>
                  )}
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${KIND_META[kind].label.toLowerCase()}`}
                      onClick={() => onDelete(block.id)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                <ReservationBlockBody
                  blockId={block.id}
                  content={block.content}
                  context={context}
                  onChange={(content, mode) => onContentChange(block.id, content, mode)}
                />
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <Button
            variant={reservations.length === 0 ? "default" : "outline"}
            onClick={onAdd}
          >
            <Plus />
            {reservations.length === 0 ? copy.add : copy.addAnother}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentsDialog({
  open,
  onOpenChange,
  canEdit,
  files,
  onUpload,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  files: TripAttachment[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (file: TripAttachment) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    const invalid = validateAttachment(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attachments</DialogTitle>
          <DialogDescription>Upload tickets, confirmations, and other files for this trip.</DialogDescription>
        </DialogHeader>

        {files.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No files yet.
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {files.map((file) => (
              <li key={file.path} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <OpenAttachmentButton path={file.path} name={file.name} />
                  <p className="mt-1 truncate text-xs text-muted-foreground">{file.caption}</p>
                </div>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removing === file.path}
                    onClick={async () => {
                      setRemoving(file.path);
                      try {
                        await onRemove(file);
                      } finally {
                        setRemoving(null);
                      }
                    }}
                  >
                    {removing === file.path ? <Loader2 className="animate-spin" /> : <X />}
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <>
            <input
              ref={input}
              type="file"
              accept={ATTACHMENT_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
            <Button disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <Paperclip />}
              {busy ? "Uploading…" : "Upload file"}
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
