import { NextRequest, NextResponse } from "next/server";
import { milesToMeters } from "@/lib/geo";
import { scorePlaces, scoredPlaceToRow } from "@/lib/deck/ranking";
import { getPlacesProvider } from "@/lib/places";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { SessionFilters, SessionWeights } from "@/lib/session/types";

// Runs once per session, right after creation (see the Create Session flow) — never per
// swiper. Cached rows in `places` are what every participant actually reads from.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = createSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, origin_lat, origin_lng, filters, weights, deck_size")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const filters = session.filters as unknown as SessionFilters;
  const weights = session.weights as unknown as SessionWeights;
  const origin = { lat: session.origin_lat, lng: session.origin_lng };
  const radiusMeters = milesToMeters(filters.radiusMiles);

  const places = await getPlacesProvider().searchNearby(
    origin,
    {
      cuisineIncludes: filters.cuisineIncludes,
      cuisineExcludes: filters.cuisineExcludes,
      maxPriceLevel: filters.price,
      radiusMeters,
    },
    { limit: session.deck_size }
  );

  const ranked = scorePlaces(places, origin, filters, weights, radiusMeters).sort(
    (a, b) => b.score - a.score
  );

  const rows = ranked.map((r, index) => scoredPlaceToRow(session.id, r, index));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("places")
      .upsert(rows, { onConflict: "session_id,provider_place_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ count: rows.length });
}
