import { NextRequest, NextResponse } from "next/server";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Proxied server-side because Nominatim's usage policy wants a real identifying User-Agent,
// and browsers won't let client code set that header on fetch — plus this keeps the app free
// to swap geocoders later without touching the Create Session screen.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: { "User-Agent": "Munch/0.1 (group restaurant picker, dev build)" },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
  }

  const results: NominatimResult[] = await response.json();
  const first = results[0];
  if (!first) {
    return NextResponse.json({ error: "No matching address found" }, { status: 404 });
  }

  return NextResponse.json({
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    label: first.display_name,
  });
}
