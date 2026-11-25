import type { Enums, Json } from "@/lib/supabase/database.types";

export type BlockType = Enums<"trip_block_type">;
export type TripRole = Enums<"trip_member_role">;

export type NoteContent = { text: string; doc?: Json };

export type CheckItem = { id: string; text: string; checked: boolean };

export type PlaceLink = { id: string; url: string };

export type PlaceListItem = {
  id: string;
  kind: "place";
  text: string;
  place_id?: string;
  visited?: boolean;
  notes?: string;
  links?: PlaceLink[];
  time?: string;
  cost?: string;
  description?: string;
  attachment_path?: string;
  attachment_name?: string;
};

export type ListItem =
  | PlaceListItem
  | { id: string; kind: "note"; text: string }
  | { id: string; kind: "checklist"; title: string; items: CheckItem[] };
export type ListContent = { items: ListItem[] };

export const RESERVATION_KINDS = ["flight", "lodging", "car", "train", "other"] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];
export type ReservationContent = {
  kind: ReservationKind;
  confirmation?: string;
  starts_at?: string;
  ends_at?: string;
  details?: string;
  attachment_path?: string;
  attachment_name?: string;
};

type BlockBase = { id: string; title: string | null; position: number; collapsed: boolean };
export type TripBlock =
  | (BlockBase & { type: "note"; content: NoteContent })
  | (BlockBase & { type: "list"; content: ListContent })
  | (BlockBase & { type: "reservation"; content: ReservationContent });

export type BlockContent = TripBlock["content"];

function asObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value: Json | undefined) {
  return typeof value === "string" ? value : undefined;
}

function parseCheckItems(raw: Json | undefined): CheckItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const item = asObject(value);
    const id = asString(item.id);
    if (!id) return [];
    return [{ id, text: asString(item.text) ?? "", checked: item.checked === true }];
  });
}

/** Accepts the current checklist shape and older flat `kind: "check"` rows. */
function parseListItems(raw: Json[]): ListItem[] {
  const items: ListItem[] = [];
  let pending: { id: string; items: CheckItem[] } | null = null;

  function flushChecks() {
    if (!pending) return;
    items.push({ id: pending.id, kind: "checklist", title: "Checklist", items: pending.items });
    pending = null;
  }

  for (const value of raw) {
    const item = asObject(value);
    const id = asString(item.id);
    if (!id) continue;

    if (item.kind === "place") {
      flushChecks();
      items.push(parsePlaceItem(id, item));
      continue;
    }
    if (item.kind === "note") {
      flushChecks();
      items.push({ id, kind: "note", text: asString(item.text) ?? "" });
      continue;
    }
    if (item.kind === "checklist") {
      flushChecks();
      items.push({
        id,
        kind: "checklist",
        title: asString(item.title) ?? "Checklist",
        items: parseCheckItems(item.items),
      });
      continue;
    }

    if (!pending) pending = { id, items: [] };
    pending.items.push({ id: `${id}:entry`, text: asString(item.text) ?? "", checked: item.checked === true });
  }

  flushChecks();
  return items;
}

function parsePlaceItem(id: string, item: Record<string, Json | undefined>): PlaceListItem {
  const time = asString(item.time);
  const links = Array.isArray(item.links)
    ? item.links.flatMap((value) => {
        const link = asObject(value);
        const linkId = asString(link.id);
        const url = asString(link.url)?.trim();
        if (!linkId || !url) return [];
        return [{ id: linkId, url: url.slice(0, 500) }];
      })
    : undefined;
  return {
    id,
    kind: "place",
    text: asString(item.text) ?? "",
    place_id: asString(item.place_id),
    visited: item.visited === true ? true : undefined,
    notes: asString(item.notes)?.slice(0, 2000),
    links: links && links.length > 0 ? links.slice(0, 12) : undefined,
    time: time && clockOk(time) ? time.slice(0, 5) : undefined,
    cost: asString(item.cost)?.trim().slice(0, 40) || undefined,
    description: asString(item.description)?.slice(0, 2000),
    attachment_path: asString(item.attachment_path),
    attachment_name: asString(item.attachment_name)?.slice(0, 120),
  };
}

function clockOk(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d/.test(value);
}

/** Normalizes a stored `content` value, tolerating rows written by older code or by hand. */
export function parseBlockContent(type: BlockType, raw: Json): BlockContent {
  const content = asObject(raw);
  if (type === "note") {
    return { text: asString(content.text) ?? "", doc: content.doc ?? undefined };
  }
  if (type === "list") {
    const items = Array.isArray(content.items) ? content.items : [];
    return { items: parseListItems(items) };
  }
  const kind = RESERVATION_KINDS.find((k) => k === content.kind) ?? "other";
  return {
    kind,
    confirmation: asString(content.confirmation),
    starts_at: asString(content.starts_at),
    ends_at: asString(content.ends_at),
    details: asString(content.details),
    attachment_path: asString(content.attachment_path),
    attachment_name: asString(content.attachment_name),
  };
}

export function emptyContent(type: BlockType): BlockContent {
  if (type === "note") return { text: "" };
  if (type === "list") return { items: [] };
  return { kind: "flight" };
}

export const DEFAULT_TITLES: Record<BlockType, string> = {
  note: "Notes",
  list: "New list",
  reservation: "Reservation",
};

/** Fractional index between two neighbours; either side may be missing. */
export function positionBetween(before: number | undefined, after: number | undefined) {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

export function canEdit(role: TripRole | null) {
  return role === "owner" || role === "editor";
}

/** File uploaded from the attachments modal, not a filled-in reservation. */
export function isStandaloneAttachment(block: TripBlock) {
  if (block.type !== "reservation") return false;
  const content = block.content;
  return (
    content.kind === "other" &&
    Boolean(content.attachment_path) &&
    !content.confirmation &&
    !content.starts_at &&
    !content.ends_at &&
    !content.details
  );
}
