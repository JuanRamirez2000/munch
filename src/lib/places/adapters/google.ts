import type { GeoPoint } from "@/lib/geo";
import type { Place, PlacesProvider, PlaceSearchFilters, SearchNearbyOptions } from "../types";

const GOOGLE_PLACES_API_BASE = "https://places.googleapis.com/v1";
// Nearby Search (New) hard-caps results per request at 20 and — unlike Yelp/mock — has no
// offset/pagination param at all; repeated calls at the same radius return the same top 20.
// load-more's existing "widen radius if the page comes up short" fallback still works fine
// here: the same-radius attempt just always dedupes away to nothing and it falls straight
// through to widening. No changes needed to the shared load-more logic for this provider.
const GOOGLE_MAX_RESULT_COUNT = 20;
const GOOGLE_MAX_RADIUS_METERS = 50_000;

// Deliberately conservative field mask — stays within the "Pro" SKU tier (photos, rating,
// price, basic identity/location), avoiding fields (like opening hours) that would escalate
// to Enterprise pricing. Matches the same "openNow always null" tradeoff made for Yelp.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.photos",
].join(",");

// Bridges our fixed 6-chip cuisine vocabulary to Google's `types` taxonomy (snake_case,
// suffixed "_restaurant"). Same pattern as the Yelp adapter's alias table.
const CUISINE_TO_GOOGLE_TYPE: Record<string, string> = {
  Sushi: "sushi_restaurant",
  Pizza: "pizza_restaurant",
  Thai: "thai_restaurant",
  BBQ: "barbecue_restaurant",
  Vegan: "vegan_restaurant",
  Burgers: "hamburger_restaurant",
  "Fast Food": "fast_food_restaurant",
};
const GOOGLE_TYPE_TO_CUISINE: Record<string, string> = Object.fromEntries(
  Object.entries(CUISINE_TO_GOOGLE_TYPE).map(([cuisine, type]) => [type, cuisine])
);

// Structural/generic types every restaurant carries — not useful as a displayed "cuisine".
const GENERIC_TYPES = new Set([
  "restaurant",
  "food",
  "point_of_interest",
  "establishment",
  "meal_takeaway",
  "meal_delivery",
]);

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 0,
  PRICE_LEVEL_MODERATE: 1,
  PRICE_LEVEL_EXPENSIVE: 2,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  priceLevel?: string;
  rating?: number;
  photos?: { name: string }[];
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
}

function humanizeType(type: string): string {
  return type
    .replace(/_restaurant$/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toCuisines(types: string[] | undefined): string[] {
  const specific = (types ?? []).filter((t) => !GENERIC_TYPES.has(t));
  const canonical = specific.map((t) => GOOGLE_TYPE_TO_CUISINE[t]).filter((c): c is string => Boolean(c));
  const humanized = specific.map(humanizeType);
  // Canonical labels first — same reasoning as the Yelp adapter's toCuisines().
  return Array.from(new Set([...canonical, ...humanized]));
}

// Capped well under Google's per-place photo count to keep the swipe card's cycling dots
// (and the deck-build request) reasonably sized — a place rarely has more than a couple of
// photos worth showing anyway.
const MAX_PHOTOS_PER_PLACE = 5;

function toPhotoUrls(photos: { name: string }[] | undefined): string[] {
  if (!photos) return [];
  // Proxied through our own route (src/app/api/photos/google/route.ts) — Google's photo
  // media endpoint requires the API key as a query param, which must never reach the client.
  return photos
    .slice(0, MAX_PHOTOS_PER_PLACE)
    .map((photo) => `/api/photos/google?name=${encodeURIComponent(photo.name)}`);
}

function matchesMaxPrice(priceLevel: number | null, maxPriceLevel: number | null): boolean {
  if (maxPriceLevel === null || priceLevel === null) return true;
  return priceLevel <= maxPriceLevel;
}

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchNearby(
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]> {
    const includedTypes = filters.cuisineIncludes
      .map((c) => CUISINE_TO_GOOGLE_TYPE[c])
      .filter((t): t is string => Boolean(t));
    const excludedTypes = filters.cuisineExcludes
      .map((c) => CUISINE_TO_GOOGLE_TYPE[c])
      .filter((t): t is string => Boolean(t));

    // includedTypes matches ANY of a place's types — right for a specific cuisine ask (a place
    // primarily Japanese that also carries "sushi_restaurant" is a reasonable match). But as
    // the no-filter-set default it's too loose: places like a hotel with an on-site restaurant
    // carry "restaurant" as a secondary type and would show up as a swipeable "restaurant".
    // includedPrimaryTypes only matches a place's main type, so it's used for that default case.
    const body = {
      ...(includedTypes.length > 0 ? { includedTypes } : { includedPrimaryTypes: ["restaurant"] }),
      ...(excludedTypes.length > 0 ? { excludedTypes } : {}),
      maxResultCount: Math.min(GOOGLE_MAX_RESULT_COUNT, options.limit),
      locationRestriction: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: Math.min(GOOGLE_MAX_RADIUS_METERS, filters.radiusMeters),
        },
      },
    };

    const response = await fetch(`${GOOGLE_PLACES_API_BASE}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google Places search failed (${response.status}): ${await response.text()}`);
    }

    const data: GoogleSearchResponse = await response.json();

    return (data.places ?? [])
      .filter((p) => p.location)
      .map((p): Place => {
        const priceLevel = p.priceLevel ? (PRICE_LEVEL_MAP[p.priceLevel] ?? null) : null;
        return {
          id: p.id,
          name: p.displayName?.text ?? "Unnamed",
          photoUrls: toPhotoUrls(p.photos),
          cuisines: toCuisines(p.types),
          priceLevel,
          rating: p.rating ?? null,
          lat: p.location!.latitude,
          lng: p.location!.longitude,
          address: p.formattedAddress ?? null,
          // See FIELD_MASK comment — opening hours aren't requested, so this stays null.
          openNow: null,
        };
      })
      .filter((place) => matchesMaxPrice(place.priceLevel, filters.maxPriceLevel));
  }
}
