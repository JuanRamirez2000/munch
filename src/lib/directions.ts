interface DirectionsTarget {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

export function getDirectionsUrl(place: DirectionsTarget): string {
  const query = place.address ? `${place.name} ${place.address}` : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
