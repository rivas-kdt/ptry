"use client";

import { ImagePlus, Loader2, Settings2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTrip, updateTrip } from "@/app/(app)/trips/actions";
import { TripForm } from "@/components/trips/trip-form";
import type { PickedDestination } from "@/components/trips/destination-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { sourceImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

const MAX_COVER_BYTES = 10 * 1024 * 1024;

export function TripSettingsDialog({
  trip,
  isOwner,
}: {
  trip: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    cover_url: string | null;
    destination: (PickedDestination & { cover_url: string | null }) | null;
  };
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(trip.cover_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const onSaved = useCallback(() => {
    setOpen(false);
    toast.success("Trip updated");
  }, []);

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      toast.error("Images must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `trips/${trip.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("covers")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setUploading(false);
    if (error) {
      console.error(error);
      toast.error("Couldn't upload that image.");
      return;
    }
    setCoverUrl(supabase.storage.from("covers").getPublicUrl(path).data.publicUrl);
  }

  const preview = coverUrl || trip.destination?.cover_url;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setCoverUrl(trip.cover_url ?? "");
          setConfirmingDelete(false);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label="Trip settings" />}>
        <Settings2 />
        <span className="hidden sm:inline">Edit</span>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip settings</DialogTitle>
          <DialogDescription>Change the destination, dates, name, or cover photo.</DialogDescription>
        </DialogHeader>

        <TripForm
          action={updateTrip}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          hiddenFields={{ trip_id: trip.id, cover_url: coverUrl }}
          defaults={{
            name: trip.name,
            destination: trip.destination,
            start_date: trip.start_date,
            end_date: trip.end_date,
          }}
          onSaved={onSaved}
        >
          <div className="flex flex-col gap-2">
            <Label>Cover photo</Label>
            <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-muted">
              {preview ? (
                <Image
                  src={sourceImageUrl(preview, 800)}
                  alt=""
                  fill
                  sizes="400px"
                  className="object-cover"
                />
              ) : null}
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus />
                Upload photo
              </Button>
              {coverUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl("")}>
                  Use destination photo
                </Button>
              ) : null}
            </div>
          </div>
        </TripForm>

        {isOwner ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            {confirmingDelete ? (
              <>
                <p className="text-sm">
                  Delete <span className="font-medium">{trip.name}</span> and everything in it? This
                  can&apos;t be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    onClick={() =>
                      startDelete(async () => {
                        const result = await deleteTrip(trip.id);
                        if (!result.ok) toast.error(result.error);
                      })
                    }
                  >
                    {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Delete trip
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 />
                Delete trip
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
