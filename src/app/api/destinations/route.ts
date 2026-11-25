import { NextResponse, type NextRequest } from "next/server";
import { searchDestinationsLive } from "@/lib/place-search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? crypto.randomUUID();
  try {
    const destinations = await searchDestinationsLive(query.trim(), session);
    return NextResponse.json({ destinations });
  } catch {
    return NextResponse.json({ error: "Destination search is unavailable right now." }, { status: 502 });
  }
}
