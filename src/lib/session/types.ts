export const CUISINE_OPTIONS = ["Sushi", "Pizza", "Thai", "BBQ", "Vegan", "Burgers", "Fast Food"] as const;
export type CuisineOption = (typeof CUISINE_OPTIONS)[number];
export type CuisineState = "none" | "include" | "exclude";

export interface SessionFilters {
  cuisineIncludes: string[];
  cuisineExcludes: string[];
  /** Max price level the group will accept, 0 ($) to 3 ($$$$). */
  price: number;
  radiusMiles: number;
}

export interface SessionWeights {
  /** 0-100, how strongly distance should influence deck ranking. */
  distanceImportance: number;
  /** 0-100, how strongly cuisine match should influence deck ranking. */
  cuisineImportance: number;
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
