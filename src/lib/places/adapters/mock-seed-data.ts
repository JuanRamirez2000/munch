// Seed places for the mock PlacesProvider. Each is defined as a (distance, bearing) offset
// from whatever origin is searched, so the deck looks locally relevant no matter where a host
// creates a session from — not tied to one real city.
export interface MockSeedPlace {
  id: string;
  name: string;
  cuisines: string[];
  priceLevel: number;
  rating: number;
  distanceMiles: number;
  bearingDeg: number;
  openNow: boolean;
  address: string;
}

export const MOCK_SEED_PLACES: MockSeedPlace[] = [
  { id: "mock-nori-sushi-bar", name: "Nori Sushi Bar", cuisines: ["Sushi"], priceLevel: 2, rating: 4.6, distanceMiles: 0.4, bearingDeg: 10, openNow: true, address: "118 Harbor St" },
  { id: "mock-trattoria-sette", name: "Trattoria Sette", cuisines: ["Italian"], priceLevel: 2, rating: 4.5, distanceMiles: 1.2, bearingDeg: 80, openNow: true, address: "27 Fountain Ave" },
  { id: "mock-bao-house", name: "Bao House", cuisines: ["Chinese", "Dumplings"], priceLevel: 1, rating: 4.3, distanceMiles: 0.9, bearingDeg: 200, openNow: true, address: "88 Canal St" },
  { id: "mock-pho-real", name: "Pho Real", cuisines: ["Vietnamese"], priceLevel: 1, rating: 4.4, distanceMiles: 1.8, bearingDeg: 260, openNow: false, address: "502 Willow Rd" },
  { id: "mock-burger-barn", name: "Burger Barn", cuisines: ["Burgers"], priceLevel: 1, rating: 4.1, distanceMiles: 2.5, bearingDeg: 300, openNow: true, address: "14 Pine St" },
  { id: "mock-slice-of-heaven", name: "Slice of Heaven", cuisines: ["Pizza"], priceLevel: 1, rating: 4.2, distanceMiles: 0.6, bearingDeg: 45, openNow: true, address: "9 Union Sq" },
  { id: "mock-napolis-table", name: "Napoli's Table", cuisines: ["Pizza", "Italian"], priceLevel: 2, rating: 4.7, distanceMiles: 3.1, bearingDeg: 120, openNow: true, address: "233 Sunset Blvd" },
  { id: "mock-green-leaf-kitchen", name: "Green Leaf Kitchen", cuisines: ["Vegan"], priceLevel: 2, rating: 4.5, distanceMiles: 1.5, bearingDeg: 340, openNow: true, address: "61 Birch Ln" },
  { id: "mock-root-and-bloom", name: "Root & Bloom", cuisines: ["Vegan"], priceLevel: 1, rating: 4.0, distanceMiles: 4.2, bearingDeg: 200, openNow: false, address: "740 Meadow Dr" },
  { id: "mock-smoke-ring-bbq", name: "Smoke Ring BBQ", cuisines: ["BBQ"], priceLevel: 2, rating: 4.6, distanceMiles: 2.9, bearingDeg: 15, openNow: true, address: "18 Ash St" },
  { id: "mock-pitmasters", name: "Pitmaster's", cuisines: ["BBQ"], priceLevel: 1, rating: 4.2, distanceMiles: 5.5, bearingDeg: 160, openNow: true, address: "365 Ranch Rd" },
  { id: "mock-bangkok-nights", name: "Bangkok Nights", cuisines: ["Thai"], priceLevel: 2, rating: 4.4, distanceMiles: 1.1, bearingDeg: 275, openNow: true, address: "52 Orchid Way" },
  { id: "mock-basil-and-lime", name: "Basil & Lime", cuisines: ["Thai"], priceLevel: 1, rating: 4.3, distanceMiles: 6.8, bearingDeg: 95, openNow: false, address: "901 Lotus Ave" },
  { id: "mock-sakura-sushi", name: "Sakura Sushi", cuisines: ["Sushi"], priceLevel: 3, rating: 4.8, distanceMiles: 3.7, bearingDeg: 220, openNow: true, address: "12 Cherry Ct" },
  { id: "mock-wasabi-wave", name: "Wasabi Wave", cuisines: ["Sushi"], priceLevel: 1, rating: 3.9, distanceMiles: 0.2, bearingDeg: 5, openNow: true, address: "3 Bay St" },
  { id: "mock-patty-palace", name: "Patty Palace", cuisines: ["Burgers"], priceLevel: 2, rating: 4.0, distanceMiles: 2.0, bearingDeg: 250, openNow: true, address: "77 Grant Ave" },
  { id: "mock-flame-burger-co", name: "Flame Burger Co", cuisines: ["Burgers"], priceLevel: 1, rating: 4.3, distanceMiles: 8.2, bearingDeg: 140, openNow: false, address: "410 Highland Dr" },
  { id: "mock-dragon-wok", name: "Dragon Wok", cuisines: ["Chinese"], priceLevel: 1, rating: 4.1, distanceMiles: 1.6, bearingDeg: 190, openNow: true, address: "6 Jade St" },
  { id: "mock-golden-dumpling", name: "Golden Dumpling", cuisines: ["Chinese", "Dumplings"], priceLevel: 1, rating: 4.5, distanceMiles: 3.3, bearingDeg: 60, openNow: true, address: "150 Lantern Rd" },
  { id: "mock-curry-house", name: "Curry House", cuisines: ["Indian"], priceLevel: 2, rating: 4.6, distanceMiles: 2.2, bearingDeg: 310, openNow: true, address: "44 Spice Ln" },
  { id: "mock-tandoor-flame", name: "Tandoor Flame", cuisines: ["Indian"], priceLevel: 1, rating: 4.2, distanceMiles: 7.0, bearingDeg: 30, openNow: true, address: "620 Saffron St" },
  { id: "mock-taco-vivo", name: "Taco Vivo", cuisines: ["Mexican"], priceLevel: 1, rating: 4.4, distanceMiles: 1.0, bearingDeg: 150, openNow: true, address: "22 Fiesta Blvd" },
  { id: "mock-el-mercado", name: "El Mercado", cuisines: ["Mexican"], priceLevel: 2, rating: 4.3, distanceMiles: 4.5, bearingDeg: 20, openNow: false, address: "305 Plaza Way" },
  { id: "mock-le-petit-bistro", name: "Le Petit Bistro", cuisines: ["French"], priceLevel: 3, rating: 4.7, distanceMiles: 9.5, bearingDeg: 70, openNow: true, address: "8 Rue Ln" },
  { id: "mock-seoul-garden", name: "Seoul Garden", cuisines: ["Korean"], priceLevel: 2, rating: 4.5, distanceMiles: 3.9, bearingDeg: 240, openNow: true, address: "91 Maple St" },
  { id: "mock-kimchi-corner", name: "Kimchi Corner", cuisines: ["Korean"], priceLevel: 1, rating: 4.1, distanceMiles: 12.0, bearingDeg: 100, openNow: true, address: "512 Garden Ave" },
  { id: "mock-the-greenhouse", name: "The Greenhouse", cuisines: ["Vegan"], priceLevel: 2, rating: 4.2, distanceMiles: 6.1, bearingDeg: 330, openNow: false, address: "19 Sprout St" },
  { id: "mock-mediterraneo", name: "Mediterraneo", cuisines: ["Mediterranean"], priceLevel: 2, rating: 4.6, distanceMiles: 2.7, bearingDeg: 175, openNow: true, address: "63 Olive Way" },
  { id: "mock-olive-and-fig", name: "Olive & Fig", cuisines: ["Mediterranean"], priceLevel: 1, rating: 4.0, distanceMiles: 14.5, bearingDeg: 55, openNow: true, address: "740 Fig St" },
  { id: "mock-ember-steakhouse", name: "Ember Steakhouse", cuisines: ["Steakhouse"], priceLevel: 3, rating: 4.7, distanceMiles: 10.2, bearingDeg: 200, openNow: true, address: "5 Grill Rd" },
  { id: "mock-quickflame", name: "QuickFlame Drive-Thru", cuisines: ["Fast Food"], priceLevel: 0, rating: 3.8, distanceMiles: 0.7, bearingDeg: 130, openNow: true, address: "40 Speedway Blvd" },
  { id: "mock-corner-combo", name: "Corner Combo", cuisines: ["Fast Food", "Burgers"], priceLevel: 1, rating: 4.0, distanceMiles: 2.3, bearingDeg: 355, openNow: true, address: "8 Rapid Ave" },
];
