"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "itinerary", label: "Itinerary" },
  { segment: "budget", label: "Budget" },
  { segment: "journal", label: "Journal" },
  { segment: "explore", label: "Explore" },
];

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;

  return (
    <nav
      aria-label="Trip sections"
      className="sticky top-14 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ segment, label }) => {
          const href = segment ? `${base}/${segment}` : base;
          const active = segment ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={label} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block px-3 py-3 text-sm font-medium transition-colors",
                  active ? "text-orange-600" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-orange-500" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
