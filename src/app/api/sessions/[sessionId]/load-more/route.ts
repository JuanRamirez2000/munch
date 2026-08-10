import { NextRequest, NextResponse } from "next/server";
import { milesToMeters } from "@/lib/geo";
import { dedupeByName, scorePlaces, scoredPlaceToRow } from "@/lib/deck/ranking";
import { getPlacesProvider } from "@/lib/places";
import type { Place } from "@/lib/places";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import type { SessionFilters, SessionWeights } from "@/lib/session/types";

const MAX_RADIUS_MILES = 50;
const RADIUS_EXPANSION_FACTOR = 1.5;

// "Load more" / "Extend search" — appends another page to the END of the existing deck
// (never reorders already-cached cards). Pages at the current radius first; if the provider
// comes up short there, widens the radius and tops up. New cards always slot in after
// whatever's already cached, so a participant mid-swipe never sees their upcoming order shift.
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

  const { data: existingPlaces, error: existingError } = await supabase
    .from("places")
    .select("provider_place_id, name")
    .eq("session_id", sessionId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const alreadyCached = new Set(existingPlaces.map((p) => p.provider_place_id));
  const alreadyCachedNames = new Set(existingPlaces.map((p) => p.name.trim().toLowerCase()));
  const filters = session.filters as unknown as SessionFilters;
  const weights = session.weights as unknown as SessionWeights;
  const origin = { lat: session.origin_lat, lng: session.origin_lng };
  const provider = getPlacesProvider();
  const startOrder = alreadyCached.size;

  // Filtered against alreadyCached explicitly rather than trusting offset-based pagination
  // alone to skip exactly what's cached — safer if a provider's ordering isn't perfectly stable.
  let radiusMiles = filters.radiusMiles;
  const firstPage = await provider.searchNearby(
    origin,
    { maxPriceLevel: filters.price, radiusMeters: milesToMeters(radiusMiles) },
    { limit: session.deck_size, offset: startOrder }
  );
  const fetched: Place[] = firstPage.filter((p) => !alreadyCached.has(p.id));

  if (fetched.length < session.deck_size) {
    const widerRadiusMiles = Math.min(MAX_RADIUS_MILES, Math.round(radiusMiles * RADIUS_EXPANSION_FACTOR));
    if (widerRadiusMiles > radiusMiles) {
      radiusMiles = widerRadiusMiles;
      const wider = await provider.searchNearby(
        origin,
        { maxPriceLevel: filters.price, radiusMeters: milesToMeters(radiusMiles) },
        { limit: session.deck_size, offset: 0 }
      );
      const seen = new Set([...alreadyCached, ...fetched.map((p) => p.id)]);
      for (const place of wider) {
        if (fetched.length >= session.deck_size) break;
        if (!seen.has(place.id)) {
          fetched.push(place);
          seen.add(place.id);
        }
      }
    }
  }

  if (fetched.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const radiusMeters = milesToMeters(radiusMiles);
  const ranked = scorePlaces(fetched, origin, filters, weights, radiusMeters).sort((a, b) => b.score - a.score);
  const deduped = dedupeByName(ranked, alreadyCachedNames);
  const rows = deduped.map((r, index) => scoredPlaceToRow(session.id, r, startOrder + index));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("places")
      .upsert(rows, { onConflict: "session_id,provider_place_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  // Persisted even when every fetched place turned out to be a name-duplicate — otherwise the
  // next load-more call retries the same already-exhausted radius instead of widening further.
  if (radiusMiles !== filters.radiusMiles) {
    await supabase
      .from("sessions")
      .update({ filters: { ...filters, radiusMiles } })
      .eq("id", sessionId);
  }

  return NextResponse.json({ count: rows.length });
}
