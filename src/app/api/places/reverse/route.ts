import { NextResponse, type NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/mapbox-search";

export async function GET(request: NextRequest) {
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  try {
    const feature = await reverseGeocode(lng, lat);
    return NextResponse.json({
      name: feature?.name ?? "Dropped pin",
      address: feature?.address ?? null,
    });
  } catch {
    return NextResponse.json({ name: "Dropped pin", address: null });
  }
}
