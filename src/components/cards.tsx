import { Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { CoverImage } from "@/components/cover-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { DestinationSummary, GuideSummary } from "@/lib/data/catalog";
import type { TripSummary } from "@/lib/data/trips";
import { formatDateRange, initials, pluralize, tripLengthInDays } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TripCard({ trip }: { trip: TripSummary }) {
  const cover = trip.cover_url ?? trip.destination?.cover_url;
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CoverImage
          src={cover}
          alt=""
          seed={trip.id}
          sizes="(min-width: 1024px) 320px, 75vw"
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <p className="truncate font-semibold">{trip.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(trip.start_date, trip.end_date)} ·{" "}
          {pluralize(tripLengthInDays(trip.start_date, trip.end_date), "day")}
        </p>
        {trip.destination ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {trip.destination.name}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function DestinationCard({
  destination,
  priority,
}: {
  destination: DestinationSummary;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/explore/${destination.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl"
    >
      <CoverImage
        src={destination.cover_url}
        alt=""
        seed={destination.slug}
        sizes="(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw"
        priority={priority}
        className="transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="font-semibold leading-tight">{destination.name}</p>
        <p className="text-xs text-white/80">{destination.country}</p>
      </div>
    </Link>
  );
}

export function GuideCard({ guide }: { guide: GuideSummary }) {
  const author = guide.author_full_name ?? guide.author_username;
  return (
    <Link
      href={`/guides/${guide.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CoverImage
          src={guide.cover_url}
          alt=""
          seed={guide.id}
          sizes="(min-width: 1024px) 300px, 75vw"
          className="transition-transform duration-300 group-hover:scale-105"
        />
        {guide.destination_name ? (
          <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {guide.destination_name}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <p className="line-clamp-2 font-semibold leading-snug">{guide.title}</p>
        {guide.intro ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{guide.intro}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <AuthorAvatar src={guide.author_avatar_url} name={author} />
            <span className="truncate">{author}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {pluralize(guide.place_count, "place")}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden />
              <span className="sr-only">Likes:</span>
              {guide.like_count}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function AuthorAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny avatar from arbitrary OAuth hosts
    return <img src={src} alt="" className="size-5 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
      {initials(name)}
    </span>
  );
}

export function CardSkeleton({ className, tall }: { className?: string; tall?: boolean }) {
  if (tall) {
    return <Skeleton className={cn("aspect-[4/5] w-full rounded-2xl", className)} />;
  }
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl ring-1 ring-foreground/10", className)}>
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-col gap-2 px-4 py-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
