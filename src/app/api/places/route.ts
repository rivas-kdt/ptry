import { NextResponse, type NextRequest } from "next/server";
import { searchPlacesLive } from "@/lib/place-search";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const destination = request.nextUrl.searchParams.get("destination");
  const session = request.nextUrl.searchParams.get("session") ?? crypto.randomUUID();
  try {
    const places = await searchPlacesLive(
      query,
      destination && UUID.test(destination) ? destination : null,
      session,
    );
    return NextResponse.json(places);
  } catch {
    return NextResponse.json({ error: "Place search is unavailable right now." }, { status: 502 });
  }
}
