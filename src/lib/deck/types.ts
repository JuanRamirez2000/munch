export interface DeckPlace {
  id: string;
  name: string;
  photoUrls: string[];
  cuisines: string[];
  diningStyles: string[];
  priceLevel: number | null;
  rating: number | null;
  ratingCount: number | null;
  lat: number;
  lng: number;
  address: string | null;
  openNow: boolean | null;
  mapsUri: string | null;
  deckOrder: number;
  score: number;
}
