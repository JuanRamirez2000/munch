import { haversineDistanceMeters, type GeoPoint } from "@/lib/geo";
import type {
  Place,
  PlacesProvider,
  PlaceSearchFilters,
  SearchNearbyOptions,
} from "../types";
import { MOCK_SEED_PLACES } from "./mock-seed-data";

const MILES_PER_DEGREE_LAT = 69.0;

// Projects a (distance, bearing) offset into a lat/lng near `origin`, correcting longitude
// degrees for the origin's latitude so the synthetic points land at roughly the right distance
// anywhere on the globe, not just near the equator.
function projectOffset(origin: GeoPoint, distanceMiles: number, bearingDeg: number): GeoPoint {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const northMiles = distanceMiles * Math.cos(bearingRad);
  const eastMiles = distanceMiles * Math.sin(bearingRad);
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);

  return {
    lat: origin.lat + northMiles / MILES_PER_DEGREE_LAT,
    lng: origin.lng + eastMiles / (milesPerDegreeLng || 1),
  };
}

// Cuisine/dining-style are soft ranking signals now (see PlaceSearchFilters) — only price and
// radius are hard filters here, matching the real adapters.
function matchesFilters(place: Place, filters: PlaceSearchFilters, distanceMeters: number): boolean {
  if (distanceMeters > filters.radiusMeters) return false;

  if (filters.maxPriceLevel !== null && place.priceLevel !== null && place.priceLevel > filters.maxPriceLevel) {
    return false;
  }

  return true;
}

// The seed data has no raw type taxonomy to bucket from (unlike Google/Yelp), so this is a
// simple heuristic rather than a real classification — good enough for local dev without a
// live API key, which is this adapter's only purpose.
function toDiningStyles(seed: { cuisines: string[]; priceLevel: number }): string[] {
  if (seed.cuisines.includes("Fast Food")) return ["Fast Food"];
  if (seed.priceLevel >= 3) return ["Fine Dining"];
  return ["Sit-down"];
}

// Stub adapter — returns deterministic seed data projected around the query origin. Swapping
// in a real provider (Google Places (New), Foursquare, Yelp) means writing one more file that
// implements PlacesProvider and normalizes that API's response into Place[]; nothing else in
// the app changes since callers only ever see the PlacesProvider interface.
export class MockPlacesProvider implements PlacesProvider {
  async searchNearby(
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]> {
    const withDistance = MOCK_SEED_PLACES.map((seed) => {
      const { lat, lng } = projectOffset(location, seed.distanceMiles, seed.bearingDeg);
      const place: Place = {
        id: seed.id,
        name: seed.name,
        photoUrls: [],
        cuisines: seed.cuisines,
        diningStyles: toDiningStyles(seed),
        priceLevel: seed.priceLevel,
        rating: seed.rating,
        ratingCount: null,
        lat,
        lng,
        address: seed.address,
        openNow: seed.openNow,
        mapsUri: null,
      };
      return { place, distanceMeters: haversineDistanceMeters(location, { lat, lng }) };
    });

    const matching = withDistance
      .filter(({ place, distanceMeters }) => matchesFilters(place, filters, distanceMeters))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map(({ place }) => place);

    const offset = options.offset ?? 0;
    return matching.slice(offset, offset + options.limit);
  }
}
