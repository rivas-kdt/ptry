import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Centered content column under the trip tabs. */
export function TripPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 pt-6", className)}>{children}</div>;
}

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Horizontal scroller on mobile that becomes a grid from `sm` up. */
export function CardRail({
  children,
  columns = "sm:grid-cols-2 lg:grid-cols-4",
}: {
  children: ReactNode;
  columns?: string;
}) {
  return (
    <ul
      className={cn(
        "relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden",
        columns,
      )}
    >
      {children}
    </ul>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="w-[75%] shrink-0 snap-start sm:w-auto">{children}</li>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
