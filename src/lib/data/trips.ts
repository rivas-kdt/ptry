import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type TripSummary = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  destination: { name: string; slug: string; cover_url: string | null } | null;
};

/** Trips the current user is a member of, split around today (UTC). */
export async function getMyTrips() {
  await requireUser("/home");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, cover_url, destination:destinations(name, slug, cover_url)")
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to load trips: ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const trips: TripSummary[] = data;
  return {
    upcoming: trips.filter((trip) => trip.end_date >= today),
    past: trips.filter((trip) => trip.end_date < today).reverse(),
  };
}
