"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JournalPhoto } from "@/lib/data/trip";
import { localISODate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 12;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

/** `uploaded` marks photos uploaded by this draft, which are removed again if it is cancelled. */
export type DraftPhoto = JournalPhoto & { uploading?: boolean; uploaded?: boolean };
export type JournalDraft = { entry_date: string; body: string; photos: DraftPhoto[] };

export function JournalComposer({
  tripId,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  tripId: string;
  initial?: JournalDraft;
  submitLabel: string;
  onSubmit: (draft: JournalDraft) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(() => initial?.entry_date ?? localISODate());
  const [body, setBody] = useState(initial?.body ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>(initial?.photos ?? []);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const uploading = photos.some((photo) => photo.uploading);
  const empty = !body.trim() && photos.length === 0;

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  async function addFiles(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast.error(`You can add up to ${MAX_PHOTOS} photos per entry.`);
    const accepted = files.slice(0, Math.max(0, room)).filter((file) => {
      if (!EXTENSIONS[file.type]) {
        toast.error(`${file.name} isn't a supported image.`);
        return false;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} is larger than 10 MB.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    const pending = accepted.map((file) => ({
      file,
      path: `${tripId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`,
      url: URL.createObjectURL(file),
    }));
    setPhotos((current) => [
      ...current,
      ...pending.map(({ path, url }) => ({ path, url, uploading: true, uploaded: true })),
    ]);

    const supabase = createClient();
    await Promise.all(
      pending.map(async ({ file, path, url }) => {
        const { error } = await supabase.storage
          .from("journal")
          .upload(path, file, { contentType: file.type, cacheControl: "3600" });
        if (error) {
          console.error(error);
          toast.error(`Couldn't upload ${file.name}.`);
          URL.revokeObjectURL(url);
          setPhotos((current) => current.filter((photo) => photo.path !== path));
        } else {
          setPhotos((current) =>
            current.map((photo) => (photo.path === path ? { ...photo, uploading: false } : photo)),
          );
        }
      }),
    );
  }

  function removePhoto(photo: DraftPhoto) {
    setPhotos((current) => current.filter((item) => item.path !== photo.path));
    if (photo.uploaded) {
      URL.revokeObjectURL(photo.url);
      void createClient().storage.from("journal").remove([photo.path]);
    }
  }

  function cancel() {
    const fresh = photos.filter((photo) => photo.uploaded && !photo.uploading);
    if (fresh.length > 0) void createClient().storage.from("journal").remove(fresh.map((photo) => photo.path));
    onCancel();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (uploading || empty || !date) return;
    onSubmit({ entry_date: date, body: body.trim(), photos: photos.map(({ path, url, uploaded }) => ({ path, url, uploaded })) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Label htmlFor="journal-date" className="text-muted-foreground">
          Date
        </Label>
        <Input
          id="journal-date"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-auto"
        />
      </div>
      <Textarea
        ref={textarea}
        aria-label="Journal entry"
        value={body}
        maxLength={10_000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What did you see, eat, and discover today?"
        className="min-h-32 resize-y"
      />

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.path} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <Image src={photo.url} alt="" fill unoptimized sizes="160px" className="object-cover" />
              {photo.uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={Object.keys(EXTENSIONS).join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void addFiles(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={photos.length >= MAX_PHOTOS}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus />
          Add photos
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={uploading || empty || !date}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {uploading ? <Loader2 className="animate-spin" /> : null}
            {uploading ? "Uploading…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
