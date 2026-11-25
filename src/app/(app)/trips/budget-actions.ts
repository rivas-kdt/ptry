"use server";

import type { Enums } from "@/lib/supabase/database.types";
import {
  FAILED,
  FORBIDDEN,
  ISO_DATE,
  isPermissionError,
  signedInClient,
  UUID,
  type ActionResult,
} from "./action-helpers";

const CURRENCY = /^[A-Z]{3}$/;
const MAX_AMOUNT = 9_999_999_999.99;
const CATEGORIES: Enums<"expense_category">[] = [
  "flights",
  "lodging",
  "transport",
  "food",
  "activities",
  "shopping",
  "other",
];

function cleanAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round(value * 100) / 100;
}

export async function saveBudget(tripId: string, total: number, currency: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  const amount = cleanAmount(total);
  if (!UUID.test(tripId) || amount === null || !CURRENCY.test(currency)) {
    return { ok: false, error: "Enter a valid amount and currency." };
  }

  const { error } = await supabase
    .from("budgets")
    .upsert({ trip_id: tripId, total: amount, currency }, { onConflict: "trip_id" });
  if (error) {
    if (isPermissionError(error)) return FORBIDDEN;
    console.error("saveBudget", error);
    return FAILED;
  }
  return { ok: true };
}

export type ExpenseInput = {
  amount: number;
  currency: string;
  category: Enums<"expense_category">;
  date: string;
  paid_by: string | null;
  note: string | null;
};

async function validateExpense(
  supabase: Awaited<ReturnType<typeof signedInClient>>["supabase"],
  tripId: string,
  input: ExpenseInput,
): Promise<{ error: string } | { values: ExpenseInput }> {
  const amount = cleanAmount(input.amount);
  if (amount === null) return { error: "Enter a valid amount." };
  if (!CURRENCY.test(input.currency)) return { error: "Pick a currency." };
  if (!CATEGORIES.includes(input.category)) return { error: "Pick a category." };
  if (!ISO_DATE.test(input.date)) return { error: "Pick a date." };
  if (input.paid_by !== null) {
    if (!UUID.test(input.paid_by)) return { error: "Pick who paid." };
    const { data } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", tripId)
      .eq("user_id", input.paid_by)
      .maybeSingle();
    if (!data) return { error: "Whoever paid needs to be on the trip." };
  }
  return {
    values: {
      amount,
      currency: input.currency,
      category: input.category,
      date: input.date,
      paid_by: input.paid_by,
      note: input.note?.trim().slice(0, 300) || null,
    },
  };
}

export async function createExpense(id: string, tripId: string, input: ExpenseInput): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(id) || !UUID.test(tripId)) return FAILED;
  const checked = await validateExpense(supabase, tripId, input);
  if ("error" in checked) return { ok: false, error: checked.error };

  const { error } = await supabase.from("expenses").insert({ id, trip_id: tripId, ...checked.values });
  if (error) {
    if (isPermissionError(error)) return FORBIDDEN;
    console.error("createExpense", error);
    return FAILED;
  }
  return { ok: true };
}

export async function updateExpense(id: string, tripId: string, input: ExpenseInput): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(id) || !UUID.test(tripId)) return FAILED;
  const checked = await validateExpense(supabase, tripId, input);
  if ("error" in checked) return { ok: false, error: checked.error };

  const { data, error } = await supabase
    .from("expenses")
    .update(checked.values)
    .eq("id", id)
    .eq("trip_id", tripId)
    .select("id");
  if (error) {
    console.error("updateExpense", error);
    return FAILED;
  }
  return data.length === 0 ? FORBIDDEN : { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { supabase } = await signedInClient();
  if (!UUID.test(id)) return FAILED;
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("id");
  if (error) {
    console.error("deleteExpense", error);
    return FAILED;
  }
  return data.length === 0 ? FORBIDDEN : { ok: true };
}
