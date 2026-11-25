import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { CoverImage } from "@/components/cover-image";
import { MemberAvatars } from "@/components/trips/member-avatars";
import { ShareDialog } from "@/components/trips/share-dialog";
import { TripSettingsDialog } from "@/components/trips/trip-settings-dialog";
import { TripTabs } from "@/components/trips/trip-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrip } from "@/lib/data/trip";
import { formatDateRange, pluralize, tripLengthInDays } from "@/lib/format";
import { canEdit } from "@/lib/trip-blocks";

export async function TripHeader({ tripId }: { tripId: string }) {
  const trip = await getTrip(tripId);
  const cover = trip.cover_url ?? trip.destination?.cover_url;

  return (
    <>
      <div className="relative h-44 bg-gradient-to-br from-red-600 via-rose-500 to-orange-400 sm:h-64">
        {cover ? (
          <CoverImage src={cover} alt="" seed={trip.id} sizes="100vw" priority />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/20" />
        <div className="absolute inset-x-0 top-0 mx-auto flex w-full max-w-5xl px-4 pt-3">
          <Link
            href="/home"
            className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/45"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Trips
          </Link>
        </div>
      </div>

      <div className="relative mx-auto -mt-14 w-full max-w-5xl px-4">
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{trip.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-4" aria-hidden />
                {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
                {pluralize(tripLengthInDays(trip.start_date, trip.end_date), "day")}
              </span>
              {trip.destination ? (
                <Link
                  href={`/explore/${trip.destination.slug}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <MapPin className="size-4" aria-hidden />
                  {trip.destination.name}, {trip.destination.country}
                </Link>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MemberAvatars members={trip.members} />
            <div className="ml-auto flex gap-2">
              <ShareDialog
                tripId={trip.id}
                members={trip.members}
                viewerId={trip.viewerId}
                isOwner={trip.role === "owner"}
              />
              {canEdit(trip.role) ? (
                <TripSettingsDialog
                  trip={{
                    id: trip.id,
                    name: trip.name,
                    start_date: trip.start_date,
                    end_date: trip.end_date,
                    cover_url: trip.cover_url,
                    destination: trip.destination,
                  }}
                  isOwner={trip.role === "owner"}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <TripTabs tripId={trip.id} />
      </div>
    </>
  );
}

export function TripHeaderSkeleton() {
  return (
    <>
      <Skeleton className="h-44 w-full rounded-none sm:h-64" />
      <div className="relative mx-auto -mt-14 w-full max-w-5xl px-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-md ring-1 ring-foreground/10 sm:p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="mx-auto mt-4 flex w-full max-w-5xl gap-4 border-b px-4 py-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-16" />
        ))}
      </div>
    </>
  );
}
