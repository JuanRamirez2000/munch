import { MockPlacesProvider } from "./adapters/mock";
import { YelpPlacesProvider } from "./adapters/yelp";
import type { PlacesProvider } from "./types";

export type { Place, PlaceSearchFilters, PlacesProvider, SearchNearbyOptions } from "./types";

// Swapping providers is a config change: add the adapter file, register it here, flip
// PLACES_PROVIDER. Nothing else in the app imports an adapter directly.
const PROVIDER_FACTORIES: Record<string, () => PlacesProvider> = {
  mock: () => new MockPlacesProvider(),
  yelp: () => {
    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey) throw new Error("YELP_API_KEY is not set");
    return new YelpPlacesProvider(apiKey);
  },
  // google: () => new GooglePlacesProvider(),
  // foursquare: () => new FoursquarePlacesProvider(),
};

let cachedProvider: PlacesProvider | undefined;

export function getPlacesProvider(): PlacesProvider {
  if (cachedProvider) return cachedProvider;

  const key = process.env.PLACES_PROVIDER ?? "mock";
  const factory = PROVIDER_FACTORIES[key];
  if (!factory) {
    throw new Error(`Unknown PLACES_PROVIDER "${key}". Available: ${Object.keys(PROVIDER_FACTORIES).join(", ")}`);
  }

  cachedProvider = factory();
  return cachedProvider;
}
