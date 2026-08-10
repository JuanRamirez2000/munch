import type { GeoPoint } from "@/lib/geo";

// The normalized shape every provider adapter must return, regardless of upstream API shape.
export interface Place {
  /** Provider-scoped identifier (e.g. Google's place_id) — stable across searches, not our DB uuid. */
  id: string;
  name: string;
  photoUrl: string | null;
  cuisines: string[];
  /** 0 ($) to 3 ($$$$), or null if the provider doesn't report it. */
  priceLevel: number | null;
  rating: number | null;
  lat: number;
  lng: number;
  address: string | null;
  openNow: boolean | null;
}

export interface PlaceSearchFilters {
  cuisineIncludes: string[];
  cuisineExcludes: string[];
  /** Maximum price level (0-3) the searcher will accept; null = no cap. */
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
