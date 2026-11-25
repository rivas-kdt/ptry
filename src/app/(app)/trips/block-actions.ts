"use server";

import type { Json } from "@/lib/supabase/database.types";
import { parseBlockContent, type BlockType } from "@/lib/trip-blocks";
import { FAILED, FORBIDDEN, signedInClient, UUID, type ActionResult } from "./action-helpers";

const BLOCK_TYPES: BlockType[] = ["note", "list", "reservation"];
const MAX_CONTENT_BYTES = 200_000;

function cleanTitle(title: unknown) {
  return typeof title === "string" ? title.trim().slice(0, 120) || null : null;
}

function cleanContent(type: BlockType, content: unknown): Json | null {
  const normalized = parseBlockContent(type, (content ?? {}) as Json) as unknown as Json;
  return JSON.stringify(normalized).length > MAX_CONTENT_BYTES ? null : normalized;
}

function cleanPosition(position: unknown) {
  return typeof position === "number" && Number.isFinite(position) ? position : null;
}


export async function createBlock(input: {
  id: string;
  tripId: string;
  type: BlockType;
  title: string | null;
  position: number;
  content: unknown;
}): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  const position = cleanPosition(input.position);
  if (!UUID.test(input.id) || !UUID.test(input.tripId) || !BLOCK_TYPES.includes(input.type) || position === null) {
    return FAILED;
  }
  const content = cleanContent(input.type, input.content);
  if (content === null) return { ok: false, error: "That block is too large." };

  const { error } = await supabase.from("trip_blocks").insert({
    id: input.id,
    trip_id: input.tripId,
    type: input.type,
    title: cleanTitle(input.title),
    position,
    content,
  });
  if (error) {
    if (error.code === "42501") return FORBIDDEN;
    console.error("createBlock", error);
    return FAILED;
  }
  return { ok: true };
}

export async function updateBlock(
  blockId: string,
  patch: { title?: string | null; collapsed?: boolean; position?: number; content?: unknown },
): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(blockId)) return FAILED;

  const update: { title?: string | null; collapsed?: boolean; position?: number; content?: Json } = {};
  if ("title" in patch) update.title = cleanTitle(patch.title);
  if (typeof patch.collapsed === "boolean") update.collapsed = patch.collapsed;
  if ("position" in patch) {
    const position = cleanPosition(patch.position);
    if (position === null) return FAILED;
    update.position = position;
  }
  if ("content" in patch) {
    const { data: block } = await supabase
      .from("trip_blocks")
      .select("type")
      .eq("id", blockId)
      .maybeSingle();
    if (!block) return FORBIDDEN;
    const content = cleanContent(block.type, patch.content);
    if (content === null) return { ok: false, error: "That block is too large." };
    update.content = content;
  }

  const { data, error } = await supabase
    .from("trip_blocks")
    .update(update)
    .eq("id", blockId)
    .select("id");
  if (error) {
    console.error("updateBlock", error);
    return FAILED;
  }
  return data.length === 0 ? FORBIDDEN : { ok: true };
}

export async function deleteBlock(blockId: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(blockId)) return FAILED;

  const { data, error } = await supabase
    .from("trip_blocks")
    .delete()
    .eq("id", blockId)
    .select("id, trip_id, content");
  if (error) {
    console.error("deleteBlock", error);
    return FAILED;
  }
  if (data.length === 0) return FORBIDDEN;

  const attachment = parseBlockContent("reservation", data[0]!.content);
  if ("attachment_path" in attachment && attachment.attachment_path) {
    await supabase.storage.from("attachments").remove([attachment.attachment_path]);
  }
  return { ok: true };
}

/** Short-lived download link for a reservation attachment; storage RLS checks membership. */
export async function getAttachmentUrl(path: string): Promise<{ url: string } | { error: string }> {
  const { supabase } = await signedInClient();
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
  if (error || !data) return { error: "Couldn't open the attachment." };
  return { url: data.signedUrl };
}
