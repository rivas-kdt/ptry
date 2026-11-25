"use client";

import { BookOpen, Loader2, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { CatalogSearchResult } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

type Suggestion = { key: string; href: string; label: string; detail: string; kind: "destination" | "guide" };

function toSuggestions(results: CatalogSearchResult): Suggestion[] {
  return [
    ...results.destinations.map((d) => ({
      key: `d-${d.id}`,
      href: `/explore/${d.slug}`,
      label: d.name,
      detail: d.country,
      kind: "destination" as const,
    })),
    ...results.guides.map((g) => ({
      key: `g-${g.id}`,
      href: `/guides/${g.id}`,
      label: g.title,
      detail: g.destination_name ?? `by ${g.author_full_name ?? g.author_username}`,
      kind: "guide" as const,
    })),
  ];
}

export function SearchBar({
  defaultValue = "",
  autoFocus,
  className,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<{ term: string; suggestions: Suggestion[]; failed?: boolean } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const term = query.trim();
  const current = results?.term === term ? results : null;
  const suggestions = current?.suggestions ?? [];
  const status =
    term.length < 2 ? "idle" : current === null ? "loading" : current.failed ? "error" : "idle";

  useEffect(() => {
    if (term.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        setResults({ term, suggestions: toSuggestions(await response.json()) });
        setActiveIndex(-1);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setResults({ term, suggestions: [], failed: true });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showPanel = open && term.length >= 2;
  const activeSuggestion = suggestions[activeIndex];

  function submit() {
    setOpen(false);
    if (activeSuggestion) {
      router.push(activeSuggestion.href);
    } else if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search destinations or guides
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeSuggestion ? `${listId}-${activeSuggestion.key}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Search destinations or guides"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-12 w-full rounded-full border bg-background pr-10 pl-11 text-sm shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {status === "loading" ? (
          <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </form>

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl bg-popover shadow-lg ring-1 ring-foreground/10">
          {status === "error" ? (
            <p className="px-4 py-3 text-sm text-destructive">Search is unavailable right now.</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {status === "loading" ? "Searching…" : `No destinations or guides match “${term}”.`}
            </p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.key}
                  id={`${listId}-${suggestion.key}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    router.push(suggestion.href);
                  }}
                  onPointerEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-2.5",
                    index === activeIndex && "bg-accent",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {suggestion.kind === "destination" ? (
                      <MapPin className="size-4" />
                    ) : (
                      <BookOpen className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{suggestion.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.kind === "destination" ? "Destination" : "Guide"} · {suggestion.detail}
                    </span>
                  </span>
                </li>
              ))}
              <li
                role="option"
                aria-selected={false}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(term)}`);
                }}
                className="cursor-pointer border-t px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent"
              >
                See all results for “{term}”
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
