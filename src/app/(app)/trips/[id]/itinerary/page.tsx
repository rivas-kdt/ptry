import type { Metadata } from "next";
import { Suspense } from "react";
import { TripPage } from "@/components/layout-primitives";
import { ItineraryBoard } from "@/components/trips/itinerary/itinerary-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getItinerary, getOverviewListPlaces, getTrip } from "@/lib/data/trip";
import { tripDays } from "@/lib/format";
import { canEdit } from "@/lib/trip-blocks";

export const metadata: Metadata = { title: "Itinerary" };

export default function ItineraryPage({ params }: PageProps<"/trips/[id]/itinerary">) {
  return (
    <TripPage className="max-w-7xl">
      <Suspense fallback={<ItinerarySkeleton />}>
        <Itinerary params={params} />
      </Suspense>
    </TripPage>
  );
}

async function Itinerary({ params }: Pick<PageProps<"/trips/[id]/itinerary">, "params">) {
  const { id } = await params;
  const [trip, items, listPlaces] = await Promise.all([
    getTrip(id),
    getItinerary(id),
    getOverviewListPlaces(id),
  ]);
  const destination = trip.destination;

  return (
    <ItineraryBoard
      key={`${trip.start_date}|${trip.end_date}`}
      tripId={trip.id}
      days={tripDays(trip.start_date, trip.end_date)}
      initialItems={items}
      listPlaces={listPlaces}
      canEdit={canEdit(trip.role)}
      destinationId={destination?.id ?? null}
      center={destination?.lat != null && destination.lng != null ? { lat: destination.lat, lng: destination.lng } : null}
    />
  );
}

function ItinerarySkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-2.5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="hidden aspect-[4/5] w-full rounded-2xl lg:block" />
    </div>
  );
}
