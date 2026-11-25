import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TripMember } from "@/lib/data/trip";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MemberAvatar({ member, className }: { member: TripMember; className?: string }) {
  const name = member.full_name ?? member.username;
  return (
    <Avatar className={className}>
      {member.avatar_url ? <AvatarImage src={member.avatar_url} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function MemberAvatars({ members, max = 4 }: { members: TripMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((member) => (
        <MemberAvatar
          key={member.user_id}
          member={member}
          className="ring-2 ring-card"
        />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-card",
          )}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
