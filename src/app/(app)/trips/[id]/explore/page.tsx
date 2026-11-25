import { Compass } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, TripPage } from "@/components/layout-primitives";
import { ExploreBoard } from "@/components/trips/explore-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getDestinationPlaces } from "@/lib/data/catalog";
import { getItinerary, getTrip } from "@/lib/data/trip";
import { formatDay, tripDays } from "@/lib/format";
import { canEdit, positionBetween } from "@/lib/trip-blocks";

export default function TripExplorePage({ params }: PageProps<"/trips/[id]/explore">) {
  return (
    <TripPage>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Explore params={params} />
      </Suspense>
    </TripPage>
  );
}

async function Explore({ params }: Pick<PageProps<"/trips/[id]/explore">, "params">) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.destination) {
    return (
      <EmptyState
        icon={<Compass />}
        title="Add a destination"
        description="Choose a destination for this trip, then places to visit will show up here."
      />
    );
  }

  const [places, items] = await Promise.all([getDestinationPlaces(trip.destination.id), getItinerary(id)]);
  const days = tripDays(trip.start_date, trip.end_date);
  const positions = Object.fromEntries(
    days.map((day) => {
      const last = items.filter((item) => item.day_date === day).at(-1)?.position;
      return [day, last ?? positionBetween(undefined, undefined) - 1];
    }),
  );

  return (
    <ExploreBoard
      tripId={trip.id}
      destinationName={trip.destination.name}
      places={places}
      canEdit={canEdit(trip.role)}
      days={days.map((day, index) => ({ date: day, label: `Day ${index + 1} · ${formatDay(day)}` }))}
      positions={positions}
      savedIds={items.flatMap((item) => (item.place ? [item.place.id] : []))}
    />
  );
}
