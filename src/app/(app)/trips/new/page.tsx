import type { Metadata } from "next";
import { Suspense } from "react";
import { createTrip } from "@/app/(app)/trips/actions";
import { TripForm } from "@/components/trips/trip-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getPopularDestinations } from "@/lib/data/catalog";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Plan a new trip" };

export default function NewTripPage({ searchParams }: PageProps<"/trips/new">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-8 pb-16 sm:pt-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Plan a new trip</h1>
        <p className="text-muted-foreground">
          Pick where and when. You can change any of this later.
        </p>
      </div>
      <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 sm:p-6">
        <Suspense fallback={<FormSkeleton />}>
          <NewTripForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function NewTripForm({ searchParams }: Pick<PageProps<"/trips/new">, "searchParams">) {
  await requireUser("/trips/new");
  const { destination: slug } = await searchParams;

  const [popular, preselected] = await Promise.all([
    getPopularDestinations(6).catch(() => []),
    typeof slug === "string" && slug
      ? createPublicClient()
          .from("destinations")
          .select("id, name, country")
          .eq("slug", slug)
          .maybeSingle()
          .then(({ data }) => data)
      : null,
  ]);

  return (
    <TripForm
      action={createTrip}
      submitLabel="Start planning"
      pendingLabel="Creating trip…"
      defaults={{ destination: preselected }}
      suggestions={popular.map(({ id, name, country }) => ({ id, name, country }))}
    />
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
