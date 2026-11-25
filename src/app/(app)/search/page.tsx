import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton, DestinationCard, GuideCard } from "@/components/cards";
import { EmptyState, Section } from "@/components/layout-primitives";
import { SearchBar } from "@/components/search/search-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { searchCatalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-6 pb-16 sm:pt-10">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchResults({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const { destinations, guides } = await searchCatalog(query.toLowerCase(), 24);

  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {query ? `Results for “${query}”` : "Search"}
        </h1>
        <SearchBar key={query} defaultValue={query} className="max-w-2xl" />
      </div>

      {query.length < 2 ? (
        <EmptyState
          icon={<SearchX />}
          title="Search for a place"
          description="Type at least two characters to find destinations and travel guides."
        />
      ) : destinations.length === 0 && guides.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No matches"
          description={`Nothing matches “${query}”. Try a city or country name.`}
        />
      ) : (
        <>
          {destinations.length > 0 ? (
            <Section title="Destinations">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {destinations.map((destination) => (
                  <li key={destination.id}>
                    <DestinationCard destination={destination} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {guides.length > 0 ? (
            <Section title="Guides">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {guides.map((guide) => (
                  <li key={guide.id}>
                    <GuideCard guide={guide} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full max-w-2xl rounded-full" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i}>
            <CardSkeleton tall />
          </li>
        ))}
      </ul>
    </div>
  );
}
