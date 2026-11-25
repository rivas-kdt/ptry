import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/lib/data/catalog";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchCatalog(query.trim().toLowerCase());
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
