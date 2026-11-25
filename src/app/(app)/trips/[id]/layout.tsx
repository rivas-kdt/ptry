import type { Metadata } from "next";
import { Suspense } from "react";
import { TripHeader, TripHeaderSkeleton } from "@/components/trips/trip-header";
import { getTrip } from "@/lib/data/trip";

export async function generateMetadata({ params }: LayoutProps<"/trips/[id]">): Promise<Metadata> {
  const { id } = await params;
  const trip = await getTrip(id);
  return { title: trip.name };
}

export default function TripLayout({ children, params }: LayoutProps<"/trips/[id]">) {
  return (
    <>
      <Suspense fallback={<TripHeaderSkeleton />}>
        <TripHeaderFromParams params={params} />
      </Suspense>
      <div className="pb-16">{children}</div>
    </>
  );
}

async function TripHeaderFromParams({ params }: Pick<LayoutProps<"/trips/[id]">, "params">) {
  const { id } = await params;
  return <TripHeader tripId={id} />;
}
