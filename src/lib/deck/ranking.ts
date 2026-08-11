import { haversineDistanceMeters, type GeoPoint } from "@/lib/geo";
import type { Place } from "@/lib/places";
import type { SessionFilters, SessionWeights } from "@/lib/session/types";
import type { Database } from "@/lib/supabase/database.types";

// Rating always counts at this baseline strength — unlike distance/cuisine, quality isn't
// something the host dials down to zero, so it's fixed rather than driven by a slider.
const RATING_WEIGHT = 1;

export interface ScoredPlace {
  place: Place;
  distanceMeters: number;
  score: number;
}

// Weighted average of three 0-1 signals (rating, distance, preference match), normalized by
// the sum of weights so the result always lands in [0, 1] regardless of where the sliders sit.
export function scorePlaces(
  places: Place[],
  origin: GeoPoint,
  filters: SessionFilters,
  weights: SessionWeights,
  radiusMeters: number
): ScoredPlace[] {
  const distanceWeight = weights.distanceImportance / 100;
  const preferenceWeight = weights.preferenceImportance / 100;
  const totalWeight = RATING_WEIGHT + distanceWeight + preferenceWeight;

  return places.map((place) => {
    const distanceMeters = haversineDistanceMeters(origin, { lat: place.lat, lng: place.lng });

    const ratingNorm = place.rating !== null ? place.rating / 5 : 0.5;
    const distanceNorm = clamp01(1 - distanceMeters / radiusMeters);
    const preferenceNorm = preferenceMatchScore(place, filters);

    const score =
      (RATING_WEIGHT * ratingNorm + distanceWeight * distanceNorm + preferenceWeight * preferenceNorm) /
      totalWeight;

    return { place, distanceMeters, score };
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Cuisine and dining-style are both soft "this is the vibe" signals now, not fetch-time filters
// (see PlaceSearchFilters) — a place that doesn't match still shows up, just ranked lower.
// Blends whichever of the three preference dimensions the host actually set (cuisine include,
// cuisine exclude, dining-style include) by averaging their individual 0-1 scores; a dimension
// nobody touched doesn't drag the average down. No preferences set at all -> neutral (1), same
// as the old cuisine-only behavior, so an untouched session doesn't penalize every place.
function preferenceMatchScore(place: Place, filters: SessionFilters): number {
  const dimensionScores: number[] = [];

  if (filters.cuisineIncludes.length > 0) {
    const overlap = place.cuisines.filter((c) => filters.cuisineIncludes.includes(c)).length;
    dimensionScores.push(clamp01(overlap / filters.cuisineIncludes.length));
  }
  if (filters.cuisineExcludes.length > 0) {
    const hasExcluded = place.cuisines.some((c) => filters.cuisineExcludes.includes(c));
    dimensionScores.push(hasExcluded ? 0 : 1);
  }
  if (filters.styleIncludes.length > 0) {
    const overlap = place.diningStyles.filter((s) => filters.styleIncludes.includes(s)).length;
    dimensionScores.push(clamp01(overlap / filters.styleIncludes.length));
  }

  if (dimensionScores.length === 0) return 1;
  return dimensionScores.reduce((sum, s) => sum + s, 0) / dimensionScores.length;
}

// Chains often have several nearby locations that a provider returns as distinct place IDs —
// same name, different address/place ID. Keeping only the first occurrence per name avoids a
// deck with three near-identical "Chipotle" cards. Call after sorting by score so the
// highest-ranked branch of a chain is the one that survives. `alreadySeenNames` lets load-more
// dedupe against names already cached in earlier pages, not just this batch.
export function dedupeByName(
  scored: ScoredPlace[],
  alreadySeenNames: Set<string> = new Set()
): ScoredPlace[] {
  const seen = new Set(alreadySeenNames);
  const result: ScoredPlace[] = [];
  for (const entry of scored) {
    const key = entry.place.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

// Shared by build-deck (fresh deck) and load-more (appending a page) so both write rows the
// same shape — deckOrder is the caller's job since it depends on how many places already exist.
export function scoredPlaceToRow(
  sessionId: string,
  scored: ScoredPlace,
  deckOrder: number
): Database["public"]["Tables"]["places"]["Insert"] {
  return {
    session_id: sessionId,
    provider_place_id: scored.place.id,
    name: scored.place.name,
    photo_urls: scored.place.photoUrls,
    cuisines: scored.place.cuisines,
    price_level: scored.place.priceLevel,
    rating: scored.place.rating,
    rating_count: scored.place.ratingCount,
    lat: scored.place.lat,
    lng: scored.place.lng,
    address: scored.place.address,
    open_now: scored.place.openNow,
    google_maps_uri: scored.place.mapsUri,
    deck_order: deckOrder,
    score: scored.score,
  };
}
