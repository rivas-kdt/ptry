"use client";

import { PencilLine, Plus, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createExpense,
  deleteExpense,
  saveBudget,
  updateExpense,
  type ExpenseInput,
} from "@/app/(app)/trips/budget-actions";
import { EmptyState } from "@/components/layout-primitives";
import { MemberAvatar } from "@/components/trips/member-avatars";
import { Button } from "@/components/ui/button";
import type { Budget, Expense, TripMember } from "@/lib/data/trip";
import { CATEGORY_BY_VALUE, EXPENSE_CATEGORIES } from "@/lib/expenses";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BudgetDialog, ExpenseDialog } from "./budget-dialogs";

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

function byNewest(a: Expense, b: Expense) {
  return b.date.localeCompare(a.date);
}

export function BudgetView({
  tripId,
  canEdit,
  members,
  viewerId,
  initialBudget,
  initialExpenses,
}: {
  tripId: string;
  canEdit: boolean;
  members: TripMember[];
  viewerId: string;
  initialBudget: Budget | null;
  initialExpenses: Expense[];
}) {
  const [budget, setBudget] = useState(initialBudget);
  const [expenses, setExpenses] = useState(() => [...initialExpenses].sort(byNewest));
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; expense: Expense | null }>({
    open: false,
    expense: null,
  });

  const membersById = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);

  const currency = useMemo(() => {
    if (budget) return budget.currency;
    const counts = new Map<string, number>();
    for (const expense of expenses) counts.set(expense.currency, (counts.get(expense.currency) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
  }, [budget, expenses]);

  const summary = useMemo(() => {
    const counted = expenses.filter((expense) => expense.currency === currency);
    const categories = EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      total: sum(counted.filter((expense) => expense.category === category.value).map((e) => e.amount)),
    }))
      .filter((category) => category.total > 0)
      .sort((a, b) => b.total - a.total);

    const payers = new Map<string | null, number>();
    for (const expense of counted) payers.set(expense.paid_by, (payers.get(expense.paid_by) ?? 0) + expense.amount);

    const others = new Map<string, number>();
    for (const expense of expenses) {
      if (expense.currency !== currency) others.set(expense.currency, (others.get(expense.currency) ?? 0) + expense.amount);
    }

    return {
      spent: sum(counted.map((expense) => expense.amount)),
      categories,
      payers: [...payers.entries()].sort((a, b) => b[1] - a[1]),
      others: [...others.entries()],
    };
  }, [expenses, currency]);

  const groups = useMemo(() => {
    const result: { date: string; expenses: Expense[] }[] = [];
    for (const expense of expenses) {
      const last = result.at(-1);
      if (last?.date === expense.date) last.expenses.push(expense);
      else result.push({ date: expense.date, expenses: [expense] });
    }
    return result;
  }, [expenses]);

  async function handleBudgetSave(next: Budget) {
    const previous = budget;
    setBudget(next);
    setBudgetOpen(false);
    const result = await saveBudget(tripId, next.total, next.currency);
    if (!result.ok) {
      setBudget(previous);
      toast.error(result.error);
    }
  }

  async function handleExpenseSave(input: ExpenseInput) {
    const editing = expenseDialog.expense;
    const id = editing?.id ?? crypto.randomUUID();
    const optimistic: Expense = { id, ...input };
    const previous = expenses;
    setExpenses((current) =>
      (editing
        ? current.map((expense) => (expense.id === id ? optimistic : expense))
        : [optimistic, ...current]
      ).sort(byNewest),
    );
    setExpenseDialog({ open: false, expense: null });

    const result = editing ? await updateExpense(id, tripId, input) : await createExpense(id, tripId, input);
    if (!result.ok) {
      setExpenses(previous);
      toast.error(result.error);
    }
    return true;
  }

  async function handleExpenseDelete(expense: Expense) {
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    setExpenseDialog({ open: false, expense: null });
    const result = await deleteExpense(expense.id);
    if (!result.ok) {
      setExpenses((current) => [...current, expense].sort(byNewest));
      toast.error(result.error);
    }
  }

  const openNewExpense = () => setExpenseDialog({ open: true, expense: null });
  const remaining = budget ? Math.round((budget.total - summary.spent) * 100) / 100 : null;
  const over = remaining !== null && remaining < 0;
  const usedPercent = budget && budget.total > 0 ? Math.min(100, (summary.spent / budget.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="budget-summary" className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="budget-summary" className="text-sm font-medium text-muted-foreground">
              {budget ? "Spent so far" : "Total spent"}
            </h2>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
              {formatMoney(summary.spent, currency)}
              {budget ? (
                <span className="ml-2 text-base font-medium text-muted-foreground">
                  of {formatMoney(budget.total, budget.currency)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <Button variant="outline" size="sm" onClick={() => setBudgetOpen(true)}>
                {budget ? <PencilLine /> : <Wallet />}
                {budget ? "Edit budget" : "Set budget"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={openNewExpense}>
                <Plus />
                Add expense
              </Button>
            ) : null}
          </div>
        </div>

        {budget ? (
          <div className="mt-4 flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPercent)}
              className="h-3 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full transition-[width]", over ? "bg-destructive" : "bg-orange-500")}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className={cn("text-sm font-medium", over ? "text-destructive" : "text-muted-foreground")}>
              {over
                ? `${formatMoney(-remaining, budget.currency)} over budget`
                : `${formatMoney(remaining ?? 0, budget.currency)} left`}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {canEdit
              ? "Set a budget to see how much you have left."
              : "No budget has been set for this trip."}
          </p>
        )}

        {summary.others.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Not included above:{" "}
            {summary.others.map(([code, total]) => formatMoney(total, code)).join(", ")}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-6 lg:order-last">
          <section aria-labelledby="by-category" className="rounded-2xl border bg-card p-5">
            <h2 id="by-category" className="font-semibold">
              By category
            </h2>
            {summary.categories.length > 0 ? (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {summary.categories.map((category) => (
                    <div
                      key={category.value}
                      className={category.bar}
                      style={{ width: `${(category.total / summary.spent) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-4 flex flex-col gap-3">
                  {summary.categories.map(({ value, label, icon: Icon, bar, chip, total }) => {
                    const share = (total / summary.spent) * 100;
                    return (
                      <li key={value} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={cn("flex size-6 items-center justify-center rounded-full", chip)}>
                            <Icon className="size-3.5" />
                          </span>
                          <span className="flex-1">{label}</span>
                          <span className="font-medium tabular-nums">{formatMoney(total, currency)}</span>
                          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                            {Math.round(share)}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className={cn("h-full rounded-full", bar)} style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Category totals appear once you log an expense in {currency}.
              </p>
            )}
          </section>

          {summary.payers.length > 0 ? (
            <section aria-labelledby="by-person" className="rounded-2xl border bg-card p-5">
              <h2 id="by-person" className="font-semibold">
                Paid by
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {summary.payers.map(([payerId, total]) => {
                  const member = payerId ? membersById.get(payerId) : undefined;
                  return (
                    <li key={payerId ?? "unassigned"} className="flex items-center gap-2.5 text-sm">
                      {member ? (
                        <MemberAvatar member={member} className="size-7" />
                      ) : (
                        <span className="size-7 rounded-full bg-muted" />
                      )}
                      <span className="flex-1 truncate">
                        {member ? (member.full_name ?? `@${member.username}`) : payerId ? "Former member" : "Not set"}
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(total, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </aside>

        <section aria-labelledby="expenses-heading" className="flex flex-col gap-3">
          <h2 id="expenses-heading" className="font-semibold">
            Expenses
          </h2>
          {groups.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title="No expenses yet"
              description={
                canEdit
                  ? "Log flights, hotels, meals and tickets to keep track of spending."
                  : "Expenses logged by the trip's editors will show up here."
              }
              action={
                canEdit ? (
                  <Button variant="outline" size="sm" onClick={openNewExpense}>
                    <Plus />
                    Add expense
                  </Button>
                ) : undefined
              }
            />
          ) : (
            groups.map((group) => (
              <div key={group.date} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatDay(group.date)}
                </h3>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {group.expenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      payer={expense.paid_by ? membersById.get(expense.paid_by) : undefined}
                      onOpen={canEdit ? () => setExpenseDialog({ open: true, expense }) : undefined}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>

      {canEdit ? (
        <>
          <BudgetDialog
            open={budgetOpen}
            onOpenChange={setBudgetOpen}
            budget={budget}
            fallbackCurrency={currency}
            onSave={handleBudgetSave}
          />
          <ExpenseDialog
            open={expenseDialog.open}
            onOpenChange={(open) => setExpenseDialog((current) => ({ ...current, open }))}
            expense={expenseDialog.expense}
            members={members}
            defaultCurrency={currency}
            defaultPayer={membersById.has(viewerId) ? viewerId : null}
            onSave={handleExpenseSave}
            onDelete={
              expenseDialog.expense
                ? () => handleExpenseDelete(expenseDialog.expense as Expense)
                : undefined
            }
          />
        </>
      ) : null}
    </div>
  );
}

function ExpenseRow({
  expense,
  payer,
  onOpen,
}: {
  expense: Expense;
  payer: TripMember | undefined;
  onOpen?: () => void;
}) {
  const category = CATEGORY_BY_VALUE[expense.category];
  const Icon = category.icon;
  const content = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", category.chip)}>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{expense.note || category.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {expense.note ? category.label : null}
          {expense.note && payer ? " · " : null}
          {payer ? `Paid by ${payer.full_name ?? `@${payer.username}`}` : null}
        </span>
      </span>
      <span className="text-sm font-semibold tabular-nums">{formatMoney(expense.amount, expense.currency)}</span>
    </>
  );

  return (
    <li>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          aria-label={`Edit ${expense.note || category.label}, ${formatMoney(expense.amount, expense.currency)}`}
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{content}</div>
      )}
    </li>
  );
}
