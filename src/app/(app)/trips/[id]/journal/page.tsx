import type { Metadata } from "next";
import { Suspense } from "react";
import { TripPage } from "@/components/layout-primitives";
import { JournalView } from "@/components/trips/journal/journal-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getJournal, getTrip } from "@/lib/data/trip";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage({ params }: PageProps<"/trips/[id]/journal">) {
  return (
    <TripPage>
      <Suspense fallback={<JournalSkeleton />}>
        <Journal params={params} />
      </Suspense>
    </TripPage>
  );
}

async function Journal({ params }: Pick<PageProps<"/trips/[id]/journal">, "params">) {
  const { id } = await params;
  const [trip, entries] = await Promise.all([getTrip(id), getJournal(id)]);

  return (
    <JournalView
      tripId={trip.id}
      viewerId={trip.viewerId}
      role={trip.role}
      members={trip.members}
      initialEntries={entries}
    />
  );
}

function JournalSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Skeleton className="h-[70px] w-full rounded-2xl" />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex flex-col gap-3 rounded-2xl border p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="aspect-[16/10] w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
