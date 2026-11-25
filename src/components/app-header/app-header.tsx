import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/app-header/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 text-sm text-white">
        P
      </span>
      Planner
    </Link>
  );
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Logo href="/home" />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/home" className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <Link href="/explore" className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
            Explore
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/trips/new"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            <Plus />
            New trip
          </Link>
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderAccount() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className={buttonVariants({ size: "sm", variant: "outline" })}>
        Log in
      </Link>
    );
  }
  const name = user.profile?.full_name ?? user.profile?.username ?? user.email ?? "Traveler";
  return (
    <UserMenu
      name={name}
      username={user.profile?.username ?? null}
      avatarUrl={user.profile?.avatar_url ?? null}
    />
  );
}
