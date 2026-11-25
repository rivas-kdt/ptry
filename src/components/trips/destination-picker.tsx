"use client";

import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { saveMapboxDestination } from "@/app/(app)/trips/place-actions";
import type { DestinationSearchHit, DestinationSummary } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export type PickedDestination = Pick<DestinationSummary, "id" | "name" | "country">;

export function DestinationPicker({
  value,
  onChange,
  suggestions = [],
  invalid,
  autoFocus,
}: {
  value: PickedDestination | null;
  onChange: (destination: PickedDestination | null) => void;
  suggestions?: PickedDestination[];
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; items: DestinationSearchHit[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [session] = useState(() => crypto.randomUUID());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/destinations?q=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const data: { destinations: DestinationSearchHit[] } = await response.json();
        setResults({ term, items: data.destinations });
        setActiveIndex(0);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setResults({ term, items: [] });
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, session]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const options: DestinationSearchHit[] =
    term.length < 2
      ? suggestions.map((destination) => ({ ...destination, lat: 0, lng: 0 }))
      : results?.term === term
        ? results.items
        : [];
  const loading = term.length >= 2 && results?.term !== term;

  async function pick(hit: DestinationSearchHit) {
    if (saving) return;
    if (hit.id) {
      onChange({ id: hit.id, name: hit.name, country: hit.country });
      setQuery("");
      setOpen(false);
      return;
    }
    setSaving(true);
    const result = await saveMapboxDestination(hit, session);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChange(result.destination);
    setQuery("");
    setOpen(false);
  }

  if (value) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3">
        <MapPin className="size-4 text-orange-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{value.name}</span>
          <span className="text-muted-foreground">, {value.country}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Change destination (${value.name})`}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-label="Destination"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Where to? e.g. Tokyo, Paris"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (event.key === "Enter" && open && options[activeIndex]) {
            event.preventDefault();
            void pick(options[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-lg border bg-background pr-9 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
      />
      {loading || saving ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {open && (options.length > 0 || (term.length >= 2 && !loading)) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg bg-popover py-1 shadow-lg ring-1 ring-foreground/10"
        >
          {term.length < 2 ? (
            <li className="px-3 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Popular</li>
          ) : null}
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No destinations match “{term}”.</li>
          ) : (
            options.map((destination, index) => (
              <li
                key={destination.id ?? destination.mapboxId ?? `${destination.name}-${destination.country}`}
                role="option"
                aria-selected={index === activeIndex}
                onPointerDown={(event) => event.preventDefault()}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => void pick(destination)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-1 px-3 py-2 text-sm",
                  index === activeIndex && "bg-accent",
                )}
              >
                <span className="font-medium">{destination.name}</span>
                <span className="text-muted-foreground">{destination.country}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
