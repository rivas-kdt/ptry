"use client";

import { BookOpen, PenLine, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
} from "@/app/(app)/trips/journal-actions";
import { EmptyState } from "@/components/layout-primitives";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { JournalEntry, JournalPhoto, TripMember } from "@/lib/data/trip";
import { formatLongDay, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TripRole } from "@/lib/trip-blocks";
import { JournalComposer, type JournalDraft } from "./journal-composer";

type Composer = { mode: "new"; draft?: JournalDraft } | { mode: "edit"; id: string; draft?: JournalDraft };

function newestFirst(a: JournalEntry, b: JournalEntry) {
  return b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at);
}

function savedPhotos(draft: JournalDraft): JournalPhoto[] {
  return draft.photos.map(({ path, url }) => ({ path, url }));
}

export function JournalView({
  tripId,
  viewerId,
  role,
  members,
  initialEntries,
}: {
  tripId: string;
  viewerId: string;
  role: TripRole | null;
  members: TripMember[];
  initialEntries: JournalEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [composer, setComposer] = useState<Composer | null>(null);
  const canWrite = role === "owner" || role === "editor";
  const viewer = members.find((member) => member.user_id === viewerId);

  const groups = useMemo(() => {
    const result: { date: string; entries: JournalEntry[] }[] = [];
    for (const entry of [...entries].sort(newestFirst)) {
      const last = result.at(-1);
      if (last?.date === entry.entry_date) last.entries.push(entry);
      else result.push({ date: entry.entry_date, entries: [entry] });
    }
    return result;
  }, [entries]);

  function replacePhotos(id: string, photos: JournalPhoto[]) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, photos } : entry)));
  }

  async function create(draft: JournalDraft) {
    const id = crypto.randomUUID();
    const entry: JournalEntry = {
      id,
      entry_date: draft.entry_date,
      body: draft.body,
      created_at: new Date().toISOString(),
      author: viewer
        ? { id: viewerId, username: viewer.username, full_name: viewer.full_name, avatar_url: viewer.avatar_url }
        : null,
      photos: savedPhotos(draft),
    };
    setEntries((current) => [entry, ...current]);
    setComposer(null);

    const result = await createJournalEntry(id, tripId, {
      entry_date: draft.entry_date,
      body: draft.body,
      photos: draft.photos.map((photo) => photo.path),
    });
    if (result.ok) {
      replacePhotos(id, result.photos);
    } else {
      setEntries((current) => current.filter((item) => item.id !== id));
      setComposer({ mode: "new", draft });
      toast.error(result.error);
    }
  }

  async function update(original: JournalEntry, draft: JournalDraft) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === original.id
          ? { ...entry, entry_date: draft.entry_date, body: draft.body, photos: savedPhotos(draft) }
          : entry,
      ),
    );
    setComposer(null);

    const result = await updateJournalEntry(original.id, {
      entry_date: draft.entry_date,
      body: draft.body,
      photos: draft.photos.map((photo) => photo.path),
    });
    if (result.ok) {
      replacePhotos(original.id, result.photos);
    } else {
      setEntries((current) => current.map((entry) => (entry.id === original.id ? original : entry)));
      setComposer({ mode: "edit", id: original.id, draft });
      toast.error(result.error);
    }
  }

  async function remove(entry: JournalEntry) {
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    const result = await deleteJournalEntry(entry.id);
    if (!result.ok) {
      setEntries((current) => [...current, entry]);
      toast.error(result.error);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {canWrite ? (
        composer?.mode === "new" ? (
          <JournalComposer
            tripId={tripId}
            initial={composer.draft}
            submitLabel="Post entry"
            onSubmit={create}
            onCancel={() => setComposer(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposer({ mode: "new" })}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left text-muted-foreground shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-orange-500/5"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
              <PenLine className="size-4" />
            </span>
            Write about your day…
          </button>
        )
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No journal entries yet"
          description={
            canWrite
              ? "Capture the moments from each day with a few words and photos."
              : "Entries from the trip's editors will show up here."
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.date} aria-label={formatLongDay(group.date)} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{formatLongDay(group.date)}</h2>
            {group.entries.map((entry) =>
              composer?.mode === "edit" && composer.id === entry.id ? (
                <JournalComposer
                  key={entry.id}
                  tripId={tripId}
                  initial={
                    composer.draft ?? { entry_date: entry.entry_date, body: entry.body, photos: entry.photos }
                  }
                  submitLabel="Save changes"
                  onSubmit={(draft) => update(entry, draft)}
                  onCancel={() => setComposer(null)}
                />
              ) : (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  canEdit={canWrite && entry.author?.id === viewerId}
                  canDelete={role === "owner" || (canWrite && entry.author?.id === viewerId)}
                  onEdit={() => setComposer({ mode: "edit", id: entry.id })}
                  onDelete={() => remove(entry)}
                />
              ),
            )}
          </section>
        ))
      )}
    </div>
  );
}

function EntryCard({
  entry,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const name = entry.author ? (entry.author.full_name ?? `@${entry.author.username}`) : "Former member";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center gap-2.5">
        <Avatar className="size-8">
          {entry.author?.avatar_url ? <AvatarImage src={entry.author.avatar_url} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-sm font-medium">{name}</span>
        {canEdit ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit entry" onClick={onEdit}>
            <PenLine />
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete entry"
            onClick={() => setConfirming(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        ) : null}
      </header>

      {entry.body ? <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{entry.body}</p> : null}
      {entry.photos.length > 0 ? <PhotoGrid photos={entry.photos} /> : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/5 p-3 text-sm">
          <span className="flex-1">Delete this entry and its photos?</span>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function PhotoGrid({ photos }: { photos: JournalPhoto[] }) {
  const single = photos.length === 1;
  return (
    <ul className={cn("grid gap-1.5", single ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {photos.map((photo, index) => (
        <li
          key={photo.path}
          className={cn("relative overflow-hidden rounded-lg bg-muted", single ? "aspect-[16/10]" : "aspect-square")}
        >
          <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1}`}>
            <Image
              src={photo.url}
              alt=""
              fill
              unoptimized
              sizes={single ? "(min-width: 672px) 640px, 100vw" : "(min-width: 672px) 210px, 33vw"}
              className="object-cover transition-transform hover:scale-[1.02]"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
