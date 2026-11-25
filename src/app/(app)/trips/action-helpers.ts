import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionError = { ok: false; error: string };
export type ActionResult = { ok: true } | ActionError;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const FAILED: ActionError = { ok: false, error: "Couldn't save that change. Try again." };
export const FORBIDDEN: ActionError = {
  ok: false,
  error: "You don't have permission to edit this trip.",
};

export async function signedInClient() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You need to be signed in.");
  return { user, supabase: await createClient() };
}

export function isPermissionError(error: { code?: string } | null) {
  return error?.code === "42501";
}
