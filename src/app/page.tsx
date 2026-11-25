import { BookOpen, CalendarDays, Compass, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/app-header/app-header";
import { CardSkeleton, GuideCard } from "@/components/cards";
import { CardRail, EmptyState, RailItem } from "@/components/layout-primitives";
import { buttonVariants } from "@/components/ui/button";
import { getFeaturedGuides } from "@/lib/data/catalog";
import { sourceImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

const HERO_IMAGE = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Day-by-day itineraries",
    description: "Drag places into each day and reorder them as plans change.",
  },
  {
    icon: Wallet,
    title: "Budget tracking",
    description: "Set a budget, log expenses by category, and see where it all went.",
  },
  {
    icon: Compass,
    title: "Explore destinations",
    description: "Browse top attractions, restaurants, cafes, and hotels in every city.",
  },
  {
    icon: BookOpen,
    title: "Guides and journals",
    description: "Follow guides from other travelers and keep a journal of your own.",
  },
];

// Signed-in visitors are redirected to /home by the proxy.
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 text-white">
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "text-white hover:bg-white/15 hover:text-white",
              )}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants(), "bg-white text-foreground hover:bg-white/90")}
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="relative isolate flex min-h-[85svh] items-end overflow-hidden">
          <Image
            src={sourceImageUrl(HERO_IMAGE, 2400)}
            alt="Turquoise sea meeting a sandy beach"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/30 to-black/40" />
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 pt-28 pb-16 text-white sm:pb-24">
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Plan your next adventure, all in one place
            </h1>
            <p className="max-w-xl text-base text-white/85 sm:text-lg">
              Build itineraries, track your budget, and discover guides for the places you want
              to go.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 bg-orange-500 px-5 text-white hover:bg-orange-600",
                )}
              >
                Plan a trip
              </Link>
              <Link
                href="#guides"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-11 border-white/60 bg-transparent px-5 text-white hover:bg-white/15 hover:text-white",
                )}
              >
                Browse guides
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </section>

        <section id="guides" className="mx-auto flex w-full max-w-6xl scroll-mt-8 flex-col gap-4 px-4 pb-16">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Guides from travelers</h2>
            <p className="text-muted-foreground">Hand-picked places and tips to start from.</p>
          </div>
          <Suspense fallback={<GuidesSkeleton />}>
            <SampleGuides />
          </Suspense>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to go somewhere?</h2>
              <p className="text-white/90">It&apos;s free to start planning.</p>
            </div>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 bg-white px-5 text-orange-600 hover:bg-white/90",
              )}
            >
              Create your first trip
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>Photos from Unsplash.</p>
        </div>
      </footer>
    </div>
  );
}

async function SampleGuides() {
  let guides: Awaited<ReturnType<typeof getFeaturedGuides>> = [];
  try {
    guides = await getFeaturedGuides(4);
  } catch (error) {
    console.error(error);
  }

  if (guides.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="Guides are on their way"
        description="Sign up to plan a trip now, and check back for travel guides."
      />
    );
  }
  return (
    <CardRail>
      {guides.map((guide) => (
        <RailItem key={guide.id}>
          <GuideCard guide={guide} />
        </RailItem>
      ))}
    </CardRail>
  );
}

function GuidesSkeleton() {
  return (
    <CardRail>
      {Array.from({ length: 4 }, (_, i) => (
        <RailItem key={i}>
          <CardSkeleton />
        </RailItem>
      ))}
    </CardRail>
  );
}
