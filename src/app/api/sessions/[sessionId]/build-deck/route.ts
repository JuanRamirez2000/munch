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
  const provider = getPlacesProvider();

  // Nearby Search always returns the same top ~20 for a fixed location/radius/price, since
  // cuisine/style no longer narrow that request (see PlaceSearchFilters) — reordering that
  // fixed pool by preference alone is a subtle effect (preference is the smallest of the three
  // score weights), so switching cuisine/style rarely surfaces a visibly different deck. When
  // the host has actually selected preferences, build the initial fetch around them via Text
  // Search instead — its relevance ranking naturally favors matching places without hard-
  // excluding anything, so a mismatched deck never goes empty. "Sit-down" is excluded from the
  // query text since it's our own internal label, not a real search term (see load-more's
  // getDominantLikedSignal for the same fix, found by testing this live).
  const filterQuery = [...filters.cuisineIncludes, ...filters.styleIncludes.filter((s) => s !== "Sit-down")].join(
    " "
  );
  const searchByQuery = provider.searchByQuery?.bind(provider);

  const places =
    filterQuery.length > 0 && searchByQuery
      ? await searchByQuery(`${filterQuery} restaurants`, origin, { maxPriceLevel: filters.price, radiusMeters }, {
          limit: session.deck_size,
        })
      : await provider.searchNearby(origin, { maxPriceLevel: filters.price, radiusMeters }, { limit: session.deck_size });

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
