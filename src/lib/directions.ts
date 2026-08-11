interface DirectionsTarget {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Provider's own place link, when available — exact, unlike the text-query URL below which
   * can occasionally resolve to the wrong branch of a chain. */
  mapsUri?: string | null;
}

export function getDirectionsUrl(place: DirectionsTarget): string {
  if (place.mapsUri) return place.mapsUri;
  const query = place.address ? `${place.name} ${place.address}` : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
