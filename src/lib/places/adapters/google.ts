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
// Text Search (New), unlike Nearby Search, actually paginates — verified live: 3 pages of 20
// with zero overlap, capping at 60 total (matches the documented limit).
const TEXT_SEARCH_PAGE_SIZE = 20;
const TEXT_SEARCH_MAX_RESULTS = 60;
// Google requires a short pause before a nextPageToken becomes valid to use.
const TEXT_SEARCH_PAGE_TOKEN_DELAY_MS = 2000;

// `rating`/`priceLevel` already put every request at the Nearby Search "Enterprise" SKU tier
// (verified directly against Google's field/pricing docs — an earlier version of this comment
// incorrectly said "Pro"). Since we're already paying for Enterprise, currentOpeningHours/
// userRatingCount/googleMapsUri are effectively free marginal additions — no reason to leave
// them off. Still deliberately excludes the next tier up ("Enterprise + Atmosphere": reviews,
// goodForGroups, outdoorSeating, etc.) since that's a real cost-tier decision, not a freebie.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.priceLevel",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
  "places.currentOpeningHours",
  "places.googleMapsUri",
].join(",");
// Text Search's field mask needs nextPageToken explicitly requested (top-level response
// fields are masked too, not just nested places.* ones) — Nearby Search has no pagination so
// its field mask is left alone rather than requesting a field it'll never return.
const TEXT_SEARCH_FIELD_MASK = `${FIELD_MASK},nextPageToken`;

// Bridges our cuisine vocabulary (session/types.ts's CUISINE_OPTIONS) to Google's `types`
// taxonomy (snake_case, suffixed "_restaurant"). Same pattern as the Yelp adapter's alias table.
const CUISINE_TO_GOOGLE_TYPE: Record<string, string> = {
  Mexican: "mexican_restaurant",
  Italian: "italian_restaurant",
  Chinese: "chinese_restaurant",
  Japanese: "japanese_restaurant",
  Sushi: "sushi_restaurant",
  Thai: "thai_restaurant",
  Indian: "indian_restaurant",
  Korean: "korean_restaurant",
  Vietnamese: "vietnamese_restaurant",
  Mediterranean: "mediterranean_restaurant",
  Greek: "greek_restaurant",
  French: "french_restaurant",
  American: "american_restaurant",
  BBQ: "barbecue_restaurant",
  Seafood: "seafood_restaurant",
  Steakhouse: "steak_house",
  Pizza: "pizza_restaurant",
  Burgers: "hamburger_restaurant",
  Vegan: "vegan_restaurant",
  "Fast Food": "fast_food_restaurant",
  "Middle Eastern": "middle_eastern_restaurant",
  Filipino: "filipino_restaurant",
};
const GOOGLE_TYPE_TO_CUISINE: Record<string, string> = Object.fromEntries(
  Object.entries(CUISINE_TO_GOOGLE_TYPE).map(([cuisine, type]) => [type, cuisine])
);

// Structural/generic types every restaurant carries, plus adjacent-business types Google
// attaches to real restaurants (catering, delivery-only listings, restaurants inside grocery
// stores, event/banquet venues) — none of these read as a "cuisine" chip. Found by sampling
// ~200 real Santa Ana, CA places: without this, 26% of places showed a junk chip like "Service"
// or "Food Store" as their top cuisine tag.
const GENERIC_TYPES = new Set([
  "restaurant",
  "food",
  "point_of_interest",
  "establishment",
  "meal_takeaway",
  "meal_delivery",
  "service",
  "food_delivery",
  "catering_service",
  "food_store",
  "store",
  "shipping_service",
  "event_venue",
  "banquet_hall",
  "night_club",
  "live_music_venue",
  "manufacturer",
  "wholesaler",
  "supplier",
  "health",
  "cafeteria",
  "barbecue_area",
]);

// Buckets Google's ~140 food/drink Table A types into our fixed 6-option dining-style
// vocabulary — a second, independent preference axis from cuisine (a place can be both "Sushi"
// and "Fast Food"-style). Anything not listed here falls through to the "Sit-down" default in
// toDiningStyles() below, since Google has no positive type for dine-in/table-service dining.
const GOOGLE_TYPE_TO_STYLE: Record<string, string> = {
  fast_food_restaurant: "Fast Food",
  meal_takeaway: "Fast Food",
  meal_delivery: "Fast Food",
  food_court: "Fast Food",
  hot_dog_stand: "Fast Food",
  pizza_delivery: "Fast Food",
  snack_bar: "Fast Food",
  cafe: "Cafe",
  coffee_shop: "Cafe",
  coffee_stand: "Cafe",
  coffee_roastery: "Cafe",
  tea_house: "Cafe",
  cat_cafe: "Cafe",
  dog_cafe: "Cafe",
  bar: "Bar",
  bar_and_grill: "Bar",
  cocktail_bar: "Bar",
  sports_bar: "Bar",
  wine_bar: "Bar",
  pub: "Bar",
  gastropub: "Bar",
  irish_pub: "Bar",
  brewery: "Bar",
  brewpub: "Bar",
  beer_garden: "Bar",
  hookah_bar: "Bar",
  lounge_bar: "Bar",
  bakery: "Bakery",
  cake_shop: "Bakery",
  pastry_shop: "Bakery",
  donut_shop: "Bakery",
  ice_cream_shop: "Bakery",
  dessert_shop: "Bakery",
  dessert_restaurant: "Bakery",
  candy_store: "Bakery",
  chocolate_shop: "Bakery",
  chocolate_factory: "Bakery",
  confectionery: "Bakery",
  acai_shop: "Bakery",
  juice_shop: "Bakery",
  fine_dining_restaurant: "Fine Dining",
  steak_house: "Fine Dining",
};

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
  userRatingCount?: number;
  photos?: { name: string }[];
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
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

function toDiningStyles(types: string[] | undefined): string[] {
  const list = types ?? [];
  const buckets = new Set<string>();
  for (const t of list) {
    const bucket = GOOGLE_TYPE_TO_STYLE[t];
    if (bucket) buckets.add(bucket);
  }
  // Residual default: something that's a restaurant (primary or secondary type) but didn't
  // match any of the faster/casual buckets above reads as traditional sit-down dining.
  if (buckets.size === 0 && (list.includes("restaurant") || list.some((t) => t.endsWith("_restaurant")))) {
    buckets.add("Sit-down");
  }
  return Array.from(buckets);
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

// Shared by searchNearby and searchByQuery — both hit different endpoints but return the same
// GooglePlace shape, so normalization into our Place type only needs writing once.
function mapGooglePlaces(places: GooglePlace[], maxPriceLevel: number | null): Place[] {
  return places
    .filter((p) => p.location)
    .map((p): Place => {
      const priceLevel = p.priceLevel ? (PRICE_LEVEL_MAP[p.priceLevel] ?? null) : null;
      return {
        id: p.id,
        name: p.displayName?.text ?? "Unnamed",
        photoUrls: toPhotoUrls(p.photos),
        cuisines: toCuisines(p.types),
        diningStyles: toDiningStyles(p.types),
        priceLevel,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? null,
        lat: p.location!.latitude,
        lng: p.location!.longitude,
        address: p.formattedAddress ?? null,
        openNow: p.currentOpeningHours?.openNow ?? null,
        mapsUri: p.googleMapsUri ?? null,
      };
    })
    .filter((place) => matchesMaxPrice(place.priceLevel, maxPriceLevel));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GooglePlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchNearby(
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]> {
    // Cuisine/dining-style no longer narrow this request — they're soft ranking signals applied
    // afterward in scorePlaces(), not a fetch-time restriction (see PlaceSearchFilters). Always
    // fetch broadly by primary type only: includedTypes (any-of-a-place's-types) would let in
    // places like a hotel whose on-site restaurant is a secondary type, not its main identity.
    const body = {
      includedPrimaryTypes: ["restaurant"],
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
    return mapGooglePlaces(data.places ?? [], filters.maxPriceLevel);
  }

  // Text Search (New) — unlike searchNearby, this actually paginates (verified live: up to 60
  // results across 3 pages), which is what load-more's "smart search" path needs when steering
  // toward a cuisine/style the group has already liked. All params besides pageToken must stay
  // identical across pages, per Google's docs; only paginates past page 1 if the caller actually
  // needs more than one page's worth, since each extra page costs a mandatory ~2s token-delay.
  async searchByQuery(
    query: string,
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]> {
    const baseBody = {
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: Math.min(GOOGLE_MAX_RADIUS_METERS, filters.radiusMeters),
        },
      },
      pageSize: TEXT_SEARCH_PAGE_SIZE,
    };

    const collected: GooglePlace[] = [];
    let pageToken: string | undefined;
    const targetCount = Math.min(TEXT_SEARCH_MAX_RESULTS, options.limit);

    do {
      if (pageToken) await sleep(TEXT_SEARCH_PAGE_TOKEN_DELAY_MS);
      const response = await fetch(`${GOOGLE_PLACES_API_BASE}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
        },
        body: JSON.stringify(pageToken ? { ...baseBody, pageToken } : baseBody),
      });

      if (!response.ok) {
        throw new Error(`Google Text Search failed (${response.status}): ${await response.text()}`);
      }

      const data: GoogleSearchResponse = await response.json();
      collected.push(...(data.places ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken && collected.length < targetCount);

    return mapGooglePlaces(collected.slice(0, targetCount), filters.maxPriceLevel);
  }
}
