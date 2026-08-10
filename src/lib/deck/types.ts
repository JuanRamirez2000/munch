export interface DeckPlace {
  id: string;
  name: string;
  photoUrl: string | null;
  cuisines: string[];
  priceLevel: number | null;
  rating: number | null;
  lat: number;
  lng: number;
  address: string | null;
  openNow: boolean | null;
  deckOrder: number;
  score: number;
}
