import type { GeoPoint } from "@/lib/geo";

// The normalized shape every provider adapter must return, regardless of upstream API shape.
export interface Place {
  /** Provider-scoped identifier (e.g. Google's place_id) — stable across searches, not our DB uuid. */
  id: string;
  name: string;
  photoUrls: string[];
  cuisines: string[];
  // Dining-style buckets (Fast Food/Cafe/Bar/Bakery/Fine Dining/Sit-down) — a normalized
  // classification an adapter derives from its own raw type/category taxonomy, parallel to
  // `cuisines`. Transient: used by scorePlaces() as a ranking signal, never persisted to the
  // places table (unlike cuisines, which is shown as a chip on the swipe card).
  diningStyles: string[];
  /** 0 ($) to 3 ($$$$), or null if the provider doesn't report it. */
  priceLevel: number | null;
  rating: number | null;
  lat: number;
  lng: number;
  address: string | null;
  openNow: boolean | null;
}

// Cuisine/dining-style are NOT here — they're soft ranking signals now (see scorePlaces()),
// not fetch-time restrictions. A provider's job is just "any restaurant, within price+radius";
// preference matching happens after the fact using the normalized cuisines/diningStyles a place
// comes back with.
export interface PlaceSearchFilters {
  /** Maximum price level (0-3) the searcher will accept; null = no cap. This IS a hard cap —
   * unlike cuisine/style, budget isn't a "vibe" the group is willing to see ranked low. */
  maxPriceLevel: number | null;
  // v1 filters by a plain radius. A future drive-time provider would swap this field
  // for an area predicate (e.g. an isochrone polygon) without changing the interface's shape.
  radiusMeters: number;
}

export interface SearchNearbyOptions {
  limit: number;
  /** Row offset into the provider's result set, for "load more" / infinite mode. */
  offset?: number;
}

export interface PlacesProvider {
  searchNearby(
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]>;
}
