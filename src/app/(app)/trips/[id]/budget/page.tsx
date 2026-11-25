import type { Metadata } from "next";
import { Suspense } from "react";
import { TripPage } from "@/components/layout-primitives";
import { BudgetView } from "@/components/trips/budget/budget-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getBudgetAndExpenses, getTrip } from "@/lib/data/trip";
import { canEdit } from "@/lib/trip-blocks";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage({ params }: PageProps<"/trips/[id]/budget">) {
  return (
    <TripPage>
      <Suspense fallback={<BudgetSkeleton />}>
        <BudgetTab params={params} />
      </Suspense>
    </TripPage>
  );
}

async function BudgetTab({ params }: Pick<PageProps<"/trips/[id]/budget">, "params">) {
  const { id } = await params;
  const [trip, { budget, expenses }] = await Promise.all([getTrip(id), getBudgetAndExpenses(id)]);

  return (
    <BudgetView
      tripId={trip.id}
      canEdit={canEdit(trip.role)}
      members={trip.members}
      viewerId={trip.viewerId}
      initialBudget={budget}
      initialExpenses={expenses}
    />
  );
}

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-2 lg:order-last">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
