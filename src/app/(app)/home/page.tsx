import { CalendarPlus, Compass, Luggage } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CardSkeleton, DestinationCard, GuideCard, TripCard } from "@/components/cards";
import { CardRail, EmptyState, RailItem, Section } from "@/components/layout-primitives";
import { SearchBar } from "@/components/search/search-bar";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getFeaturedGuides, getPopularDestinations } from "@/lib/data/catalog";
import { getMyTrips } from "@/lib/data/trips";
import { sourceImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-16 sm:pt-10">
      <div className="flex flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-8 w-56" />}>
          <Greeting />
        </Suspense>
        <SearchBar className="max-w-2xl" />
      </div>

      <Section title="Your trips" action={{ href: "/trips/new", label: "New trip" }}>
        <Suspense fallback={<RailSkeleton count={3} />}>
          <MyTrips />
        </Suspense>
      </Section>

      <PlanBanner />

      <Section title="Popular destinations" action={{ href: "/explore", label: "See all" }}>
        <Suspense fallback={<DestinationGridSkeleton />}>
          <PopularDestinations />
        </Suspense>
      </Section>

      <Section title="Featured guides">
        <Suspense fallback={<RailSkeleton count={4} />}>
          <FeaturedGuides />
        </Suspense>
      </Section>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const name = user?.profile?.full_name?.split(" ")[0] ?? user?.profile?.username;
  return (
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
      {name ? `Where to next, ${name}?` : "Where to next?"}
    </h1>
  );
}

async function MyTrips() {
  const { upcoming, past } = await getMyTrips();

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        icon={<Luggage />}
        title="No trips yet"
        description="Start a trip to collect places, build a day-by-day itinerary, and track your budget."
        action={
          <Link href="/trips/new" className={buttonVariants()}>
            <CalendarPlus />
            Plan a trip
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {upcoming.length > 0 ? (
        <CardRail columns="sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((trip) => (
            <RailItem key={trip.id}>
              <TripCard trip={trip} />
            </RailItem>
          ))}
        </CardRail>
      ) : (
        <p className="text-sm text-muted-foreground">
          No upcoming trips.{" "}
          <Link href="/trips/new" className="font-medium text-foreground underline underline-offset-4">
            Plan the next one
          </Link>
        </p>
      )}
      {past.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Past trips</h3>
          <CardRail columns="sm:grid-cols-3 lg:grid-cols-4">
            {past.map((trip) => (
              <RailItem key={trip.id}>
                <TripCard trip={trip} />
              </RailItem>
            ))}
          </CardRail>
        </div>
      ) : null}
    </div>
  );
}

function PlanBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white">
      <div className="absolute inset-y-0 right-0 hidden w-1/2 sm:block">
        <Image
          src={sourceImageUrl(BANNER_IMAGE, 1200)}
          alt=""
          fill
          sizes="50vw"
          className="object-cover [mask-image:linear-gradient(to_right,transparent,black_40%)]"
        />
      </div>
      <div className="relative flex flex-col items-start gap-3 p-6 sm:w-1/2 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Plan your own adventure</h2>
        <p className="max-w-sm text-sm text-white/90 sm:text-base">
          Pick a destination and dates, then build your itinerary day by day.
        </p>
        <Link
          href="/trips/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-1 bg-white text-orange-600 hover:bg-white/90",
          )}
        >
          Plan new trip
        </Link>
      </div>
    </section>
  );
}

async function PopularDestinations() {
  const destinations = await getPopularDestinations(10);
  if (destinations.length === 0) {
    return (
      <EmptyState
        icon={<Compass />}
        title="No destinations yet"
        description="Destinations appear here once the catalog is seeded."
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {destinations.map((destination, index) => (
        <li key={destination.id}>
          <DestinationCard destination={destination} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}

async function FeaturedGuides() {
  const guides = await getFeaturedGuides(8);
  if (guides.length === 0) {
    return (
      <EmptyState
        icon={<Compass />}
        title="No guides yet"
        description="Published guides from other travelers will show up here."
      />
    );
  }
  return (
    <CardRail>
      {guides.map((guide) => (
        <RailItem key={guide.id}>
          <GuideCard guide={guide} />
        </RailItem>
      ))}
    </CardRail>
  );
}

function RailSkeleton({ count }: { count: number }) {
  return (
    <CardRail columns={count === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : undefined}>
      {Array.from({ length: count }, (_, i) => (
        <RailItem key={i}>
          <CardSkeleton />
        </RailItem>
      ))}
    </CardRail>
  );
}

function DestinationGridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i}>
          <CardSkeleton tall />
        </li>
      ))}
    </ul>
  );
}
