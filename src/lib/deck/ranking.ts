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

// Weighted average of three 0-1 signals (rating, distance, cuisine match), normalized by the
// sum of weights so the result always lands in [0, 1] regardless of where the sliders sit.
export function scorePlaces(
  places: Place[],
  origin: GeoPoint,
  filters: SessionFilters,
  weights: SessionWeights,
  radiusMeters: number
): ScoredPlace[] {
  const distanceWeight = weights.distanceImportance / 100;
  const cuisineWeight = weights.cuisineImportance / 100;
  const totalWeight = RATING_WEIGHT + distanceWeight + cuisineWeight;

  return places.map((place) => {
    const distanceMeters = haversineDistanceMeters(origin, { lat: place.lat, lng: place.lng });

    const ratingNorm = place.rating !== null ? place.rating / 5 : 0.5;
    const distanceNorm = clamp01(1 - distanceMeters / radiusMeters);
    const cuisineNorm = cuisineMatchScore(place.cuisines, filters.cuisineIncludes);

    const score =
      (RATING_WEIGHT * ratingNorm + distanceWeight * distanceNorm + cuisineWeight * cuisineNorm) /
      totalWeight;

    return { place, distanceMeters, score };
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Places are already hard-filtered to have at least one included cuisine (or no filter was
// set) — this just scores *how much* of the requested list a place covers, so e.g. a place
// tagged both "Chinese" and "Dumplings" outranks one that only matches one requested cuisine.
function cuisineMatchScore(placeCuisines: string[], cuisineIncludes: string[]): number {
  if (cuisineIncludes.length === 0) return 1;
  const overlap = placeCuisines.filter((c) => cuisineIncludes.includes(c)).length;
  return clamp01(overlap / cuisineIncludes.length);
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
    photo_url: scored.place.photoUrl,
    cuisines: scored.place.cuisines,
    price_level: scored.place.priceLevel,
    rating: scored.place.rating,
    lat: scored.place.lat,
    lng: scored.place.lng,
    address: scored.place.address,
    open_now: scored.place.openNow,
    deck_order: deckOrder,
    score: scored.score,
  };
}
