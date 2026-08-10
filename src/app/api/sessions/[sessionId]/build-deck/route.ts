import { NextRequest, NextResponse } from "next/server";
import { milesToMeters } from "@/lib/geo";
import { dedupeByName, scorePlaces, scoredPlaceToRow } from "@/lib/deck/ranking";
import { getPlacesProvider } from "@/lib/places";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { SessionFilters, SessionWeights } from "@/lib/session/types";

// A full (re)build of the deck — called right after session creation, and again whenever the
// host edits filters/weights in the lobby. Always safe to re-run: it only ever runs pre-Start,
// and votes can't exist until the session is active, so clearing and re-scoring from scratch
// can't orphan anyone's vote. (Once swiping starts, load-more takes over — it only ever
// appends, never touches what's already cached.) Never called per-swiper.
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

  const { error: deleteError } = await supabase.from("places").delete().eq("session_id", session.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
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
  const deduped = dedupeByName(ranked);

  const rows = deduped.map((r, index) => scoredPlaceToRow(session.id, r, index));

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
