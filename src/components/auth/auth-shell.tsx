import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-sm ring-1 ring-foreground/10 sm:p-8">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Planner
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>
        <Suspense fallback={<AuthFormSkeleton />}>{children}</Suspense>
      </div>
    </main>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
