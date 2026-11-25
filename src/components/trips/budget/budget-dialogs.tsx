"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ExpenseInput } from "@/app/(app)/trips/budget-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Budget, Expense, TripMember } from "@/lib/data/trip";
import { COMMON_CURRENCIES, EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/expenses";
import { localISODate } from "@/lib/format";

export const selectClass =
  "h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function CurrencySelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const options = COMMON_CURRENCIES.includes(value) ? COMMON_CURRENCIES : [value, ...COMMON_CURRENCIES];
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
      {options.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}

function parseAmount(value: string) {
  const amount = Number(value);
  return value.trim() !== "" && Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function BudgetDialog({
  open,
  onOpenChange,
  budget,
  fallbackCurrency,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  fallbackCurrency: string;
  onSave: (budget: Budget) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "Set a budget"}</DialogTitle>
          <DialogDescription>Expenses in this currency count toward the total.</DialogDescription>
        </DialogHeader>
        <BudgetForm budget={budget} fallbackCurrency={fallbackCurrency} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({
  budget,
  fallbackCurrency,
  onSave,
}: {
  budget: Budget | null;
  fallbackCurrency: string;
  onSave: (budget: Budget) => void;
}) {
  const [total, setTotal] = useState(budget ? String(budget.total) : "");
  const [currency, setCurrency] = useState(budget?.currency ?? fallbackCurrency);
  const amount = parseAmount(total);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (amount !== null) onSave({ total: amount, currency });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-total">Total</Label>
          <Input
            id="budget-total"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="2000"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-currency">Currency</Label>
          <CurrencySelect id="budget-currency" value={currency} onChange={setCurrency} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={amount === null}>
          Save budget
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  members,
  defaultCurrency,
  defaultPayer,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  members: TripMember[];
  defaultCurrency: string;
  defaultPayer: string | null;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  onDelete?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Track what was spent, when, and who paid.</DialogDescription>
        </DialogHeader>
        <ExpenseForm
          expense={expense}
          members={members}
          defaultCurrency={defaultCurrency}
          defaultPayer={defaultPayer}
          onSave={onSave}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  expense,
  members,
  defaultCurrency,
  defaultPayer,
  onSave,
  onDelete,
}: {
  expense: Expense | null;
  members: TripMember[];
  defaultCurrency: string;
  defaultPayer: string | null;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  onDelete?: () => void;
}) {
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "food");
  const [date, setDate] = useState(() => expense?.date ?? localISODate());
  const [paidBy, setPaidBy] = useState(expense ? (expense.paid_by ?? "") : (defaultPayer ?? ""));
  const [note, setNote] = useState(expense?.note ?? "");
  const [saving, setSaving] = useState(false);
  const parsed = parseAmount(amount);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (parsed === null || !date) return;
    setSaving(true);
    const saved = await onSave({
      amount: parsed,
      currency,
      category,
      date,
      paid_by: paidBy || null,
      note: note.trim() || null,
    });
    if (!saved) setSaving(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input
            id="expense-amount"
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            required
            autoFocus={!expense}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-currency">Currency</Label>
          <CurrencySelect id="expense-currency" value={currency} onChange={setCurrency} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-checked:border-orange-500 has-checked:bg-orange-50 has-checked:text-orange-700 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 dark:has-checked:bg-orange-500/15 dark:has-checked:text-orange-300"
            >
              <input
                type="radio"
                name="category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                className="sr-only"
              />
              <Icon className="size-3.5" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-paid-by">Paid by</Label>
          <select
            id="expense-paid-by"
            value={paidBy}
            onChange={(event) => setPaidBy(event.target.value)}
            className={selectClass}
          >
            <option value="">Not set</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.full_name ?? `@${member.username}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-note">Note</Label>
        <Input
          id="expense-note"
          maxLength={300}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Dinner at Time Out Market"
        />
      </div>

      <DialogFooter className="sm:justify-between">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
            Delete
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button type="submit" disabled={parsed === null || !date || saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {expense ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
