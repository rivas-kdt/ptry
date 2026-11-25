"use client";

import { Loader2, Share2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addTripMember,
  removeTripMember,
  updateTripMemberRole,
  type ActionResult,
} from "@/app/(app)/trips/actions";
import { MemberAvatar } from "@/components/trips/member-avatars";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TripMember } from "@/lib/data/trip";
import type { TripRole } from "@/lib/trip-blocks";

const ROLE_LABELS: Record<TripRole, string> = { owner: "Owner", editor: "Can edit", viewer: "Can view" };

const selectClass =
  "h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function ShareDialog({
  tripId,
  members,
  viewerId,
  isOwner,
}: {
  tripId: string;
  members: TripMember[];
  viewerId: string;
  isOwner: boolean;
}) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<TripRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, success?: string) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (success) toast.success(success);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Share2 />
        Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this trip</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Invite people by their username. Editors can change plans; viewers can only look."
              : "People who can see this trip."}
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const handle = username;
              run(async () => {
                const result = await addTripMember(tripId, handle, role);
                if (result.ok) setUsername("");
                return result;
              }, `Added @${handle.replace(/^@/, "")}`);
            }}
          >
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@username"
              aria-label="Username"
              autoComplete="off"
              className="h-9 flex-1"
            />
            <div className="flex gap-2">
              <select
                aria-label="Role"
                value={role}
                onChange={(event) => setRole(event.target.value as TripRole)}
                className={selectClass}
              >
                <option value="editor">{ROLE_LABELS.editor}</option>
                <option value="viewer">{ROLE_LABELS.viewer}</option>
              </select>
              <Button type="submit" disabled={pending || !username.trim()} className="h-9">
                {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Invite
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {members.map((member) => {
            const isSelf = member.user_id === viewerId;
            return (
              <li key={member.user_id} className="flex items-center gap-3">
                <MemberAvatar member={member} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.full_name ?? member.username}
                    {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">@{member.username}</p>
                </div>
                {isOwner && member.role !== "owner" ? (
                  <select
                    aria-label={`Role for @${member.username}`}
                    value={member.role}
                    disabled={pending}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "remove") {
                        run(() => removeTripMember(tripId, member.user_id), `Removed @${member.username}`);
                      } else {
                        run(() => updateTripMemberRole(tripId, member.user_id, next as TripRole));
                      }
                    }}
                    className={selectClass}
                  >
                    <option value="editor">{ROLE_LABELS.editor}</option>
                    <option value="viewer">{ROLE_LABELS.viewer}</option>
                    <option value="remove">Remove</option>
                  </select>
                ) : isSelf && member.role !== "owner" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => removeTripMember(tripId, member.user_id))}
                  >
                    Leave
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
