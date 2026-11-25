import {
  BedDouble,
  CircleDollarSign,
  Plane,
  ShoppingBag,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/lib/supabase/database.types";

export type ExpenseCategory = Enums<"expense_category">;

export const EXPENSE_CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes; kept as full literals so they're generated. */
  bar: string;
  chip: string;
}[] = [
  { value: "flights", label: "Flights", icon: Plane, bar: "bg-sky-500", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "lodging", label: "Lodging", icon: BedDouble, bar: "bg-violet-500", chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { value: "transport", label: "Transport", icon: TrainFront, bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { value: "food", label: "Food & drink", icon: UtensilsCrossed, bar: "bg-amber-500", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { value: "activities", label: "Activities", icon: Ticket, bar: "bg-rose-500", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  { value: "shopping", label: "Shopping", icon: ShoppingBag, bar: "bg-pink-500", chip: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  { value: "other", label: "Other", icon: CircleDollarSign, bar: "bg-slate-500", chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
];

export const CATEGORY_BY_VALUE = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.value, category]),
) as Record<ExpenseCategory, (typeof EXPENSE_CATEGORIES)[number]>;

export const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "KRW", "CNY", "HKD", "SGD", "THB", "IDR", "PHP", "VND", "INR",
  "AUD", "NZD", "CAD", "MXN", "BRL", "CHF", "SEK", "NOK", "DKK", "CZK", "PLN", "TRY", "AED", "ZAR",
];
