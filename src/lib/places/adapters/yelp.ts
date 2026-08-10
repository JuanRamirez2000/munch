import type { GeoPoint } from "@/lib/geo";
import type { Place, PlacesProvider, PlaceSearchFilters, SearchNearbyOptions } from "../types";

const YELP_API_BASE = "https://api.yelp.com/v3";
// Yelp rejects radius values above this (~24.8mi) — load-more's radius-widening fallback
// will just plateau here rather than error once a session's search area hits the cap.
const YELP_MAX_RADIUS_METERS = 40_000;

// Bridges our fixed 6-chip cuisine vocabulary (Create Session's UI) to Yelp's much larger,
// differently-worded category taxonomy (e.g. Yelp titles BBQ "Barbeque"). Query-building uses
// the alias side; response normalization uses the reverse map so cuisineIncludes/Excludes
// (which compare against our vocabulary) keep working regardless of provider.
const CUISINE_TO_YELP_ALIAS: Record<string, string> = {
  Sushi: "sushi",
  Pizza: "pizza",
  Thai: "thai",
  BBQ: "bbq",
  Vegan: "vegan",
  Burgers: "burgers",
  // Yelp's taxonomy names this category "hotdogs" for historical reasons; the display title
  // is "Fast Food", which is what actually reaches users.
  "Fast Food": "hotdogs",
};
const YELP_ALIAS_TO_CUISINE: Record<string, string> = Object.fromEntries(
  Object.entries(CUISINE_TO_YELP_ALIAS).map(([cuisine, alias]) => [alias, cuisine])
);

interface YelpCategory {
  alias: string;
  title: string;
}

interface YelpBusiness {
  id: string;
  name: string;
  image_url: string | null;
  categories: YelpCategory[];
  price?: string;
  rating: number;
  coordinates: { latitude: number | null; longitude: number | null };
  location: { display_address: string[] };
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
}

function toCuisines(categories: YelpCategory[]): string[] {
  const canonical = categories.map((c) => YELP_ALIAS_TO_CUISINE[c.alias]).filter((c): c is string => Boolean(c));
  const titles = categories.map((c) => c.title);
  // Canonical labels first: cuisines[0] (the swipe card's chip) prefers our short vocabulary
  // when it applies, falling back to Yelp's own title for categories outside that vocabulary.
  return Array.from(new Set([...canonical, ...titles]));
}

function toPriceLevel(price: string | undefined): number | null {
  return price ? price.length - 1 : null;
}

function matchesExcludes(cuisines: string[], cuisineExcludes: string[]): boolean {
  if (cuisineExcludes.length === 0) return true;
  return !cuisines.some((c) => cuisineExcludes.includes(c));
}

export class YelpPlacesProvider implements PlacesProvider {
  constructor(private readonly apiKey: string) {}

  async searchNearby(
    location: GeoPoint,
    filters: PlaceSearchFilters,
    options: SearchNearbyOptions
  ): Promise<Place[]> {
    const url = new URL(`${YELP_API_BASE}/businesses/search`);
    url.searchParams.set("latitude", String(location.lat));
    url.searchParams.set("longitude", String(location.lng));
    url.searchParams.set("radius", String(Math.min(YELP_MAX_RADIUS_METERS, Math.round(filters.radiusMeters))));
    url.searchParams.set("limit", String(Math.min(50, options.limit)));
    if (options.offset) {
      url.searchParams.set("offset", String(options.offset));
    }
    url.searchParams.set("sort_by", "best_match");

    const includeAliases = filters.cuisineIncludes
      .map((c) => CUISINE_TO_YELP_ALIAS[c])
      .filter((alias): alias is string => Boolean(alias));
    // Yelp has no "exclude category" query param — excludes are applied client-side below.
    // Falls back to Yelp's broad "restaurants" category so an unfiltered search doesn't pull
    // in salons, retail, etc.
    url.searchParams.set("categories", includeAliases.length > 0 ? includeAliases.join(",") : "restaurants");

    if (filters.maxPriceLevel !== null) {
      // Yelp's price param is "at these levels" (1-4, comma-separated), not a ceiling —
      // 1..cap+1 expresses "up to this price".
      const levels = Array.from({ length: filters.maxPriceLevel + 1 }, (_, i) => i + 1);
      url.searchParams.set("price", levels.join(","));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Yelp search failed (${response.status}): ${await response.text()}`);
    }

    const data: YelpSearchResponse = await response.json();

    return data.businesses
      .filter((b) => b.coordinates.latitude !== null && b.coordinates.longitude !== null)
      .map((b): Place => {
        const cuisines = toCuisines(b.categories);
        return {
          id: b.id,
          name: b.name,
          // Yelp's search response only ever includes one photo per business (a details call
          // per business would be needed for more, which we won't do per-place in a shared
          // deck build) — the swipe card's photo-cycling control just won't render for these.
          photoUrls: b.image_url ? [b.image_url] : [],
          cuisines,
          priceLevel: toPriceLevel(b.price),
          rating: b.rating,
          lat: b.coordinates.latitude as number,
          lng: b.coordinates.longitude as number,
          address: b.location.display_address.length > 0 ? b.location.display_address.join(", ") : null,
          // Yelp's search response doesn't include live open/closed hours — a details call
          // per business would be needed for that, which we won't do per-place in a shared
          // deck build. The "Open now" chip just won't render for Yelp-sourced cards.
          openNow: null,
        };
      })
      .filter((place) => matchesExcludes(place.cuisines, filters.cuisineExcludes));
  }
}
