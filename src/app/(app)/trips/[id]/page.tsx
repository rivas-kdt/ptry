import { Suspense } from "react";
import { OverviewBoard } from "@/components/trips/overview/overview-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlaceDetails } from "@/lib/data/catalog";
import { getTrip, getTripBlocks } from "@/lib/data/trip";
import { canEdit } from "@/lib/trip-blocks";

export default function TripOverviewPage({ params }: PageProps<"/trips/[id]">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: Pick<PageProps<"/trips/[id]">, "params">) {
  const { id } = await params;
  const [trip, blocks] = await Promise.all([getTrip(id), getTripBlocks(id)]);
  const placeIds = blocks.flatMap((block) =>
    block.type === "list"
      ? block.content.items.flatMap((item) => (item.kind === "place" && item.place_id ? [item.place_id] : []))
      : [],
  );
  const details = await getPlaceDetails(placeIds);
  const destination = trip.destination;
  return (
    <OverviewBoard
      tripId={trip.id}
      destinationId={destination?.id ?? null}
      center={
        destination?.lat != null && destination.lng != null
          ? { lat: destination.lat, lng: destination.lng }
          : null
      }
      canEdit={canEdit(trip.role)}
      initialBlocks={blocks}
      places={Object.fromEntries(details.map((place) => [place.id, place]))}
    />
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-6">
      <div className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-foreground/10">
        <Skeleton className="h-5 w-52" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-24" />
          ))}
        </div>
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
