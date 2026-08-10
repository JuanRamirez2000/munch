export const CUISINE_OPTIONS = ["Sushi", "Pizza", "Thai", "BBQ", "Vegan", "Burgers", "Fast Food"] as const;
export type CuisineOption = (typeof CUISINE_OPTIONS)[number];

// Dining-style buckets — a second, independent preference axis from cuisine (a place can be
// both "Sushi" and "Fast Food"-style). Google Places (New) has no positive "sit-down"/"dine-in"
// type, so "Sit-down" is implemented as the residual bucket: a restaurant that doesn't match
// any of the other five. See src/lib/places/adapters/google.ts's toDiningStyles().
export const DINING_STYLE_OPTIONS = ["Fast Food", "Cafe", "Bar", "Bakery", "Fine Dining", "Sit-down"] as const;
export type DiningStyleOption = (typeof DINING_STYLE_OPTIONS)[number];

// Shared 3-state chip cycle, used for both cuisine chips (none/include/exclude) and dining-style
// chips (none/include only — see FiltersEditor's cycleStyle, which skips "exclude").
export type PreferenceState = "none" | "include" | "exclude";

export interface SessionFilters {
  cuisineIncludes: string[];
  cuisineExcludes: string[];
  // Dining-style is include-only (no exclude state) — see DINING_STYLE_OPTIONS.
  styleIncludes: string[];
  /** Max price level the group will accept, 0 ($) to 3 ($$$$) — a hard cap, not a preference. */
  price: number;
  radiusMiles: number;
}

export interface SessionWeights {
  /** 0-100, how strongly distance should influence deck ranking. */
  distanceImportance: number;
  /** 0-100, how strongly cuisine AND dining-style match should influence deck ranking —
   * a single combined signal rather than two near-identical sliders. */
  preferenceImportance: number;
}

export type SessionStatus = "lobby" | "active" | "finished";

export interface Session {
  id: string;
  shortCode: string;
  originLat: number;
  originLng: number;
  filters: SessionFilters;
  weights: SessionWeights;
  status: SessionStatus;
  deckSize: number;
  createdAt: string;
  expiresAt: string;
}

export interface Participant {
  id: string;
  sessionId: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
}
