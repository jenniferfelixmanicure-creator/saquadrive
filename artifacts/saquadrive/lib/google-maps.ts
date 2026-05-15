// Geocoding e roteamento usando Nominatim (OpenStreetMap) e OSRM — sem chave necessária

export type RouteResult = {
  polylineCoords: { latitude: number; longitude: number }[];
  distance: number;
  duration: string;
  distanceText: string;
};

export type PlaceResult = {
  placeId: string;
  description: string;
  lat: number;
  lng: number;
};

// Busca de endereços via Nominatim (OpenStreetMap)
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "5",
      countrycodes: "br",
      addressdetails: "1",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "Accept-Language": "pt-BR",
          "User-Agent": "SaquaDrive/1.0",
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json() as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
    }>;

    return data.map((item) => ({
      placeId: item.place_id.toString(),
      description: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
}

// Detalhes de um lugar — já temos lat/lng do searchPlaces, retorna direto
export async function getPlaceDetails(
  placeId: string,
  lat?: number,
  lng?: number
): Promise<{ lat: number; lng: number; address: string } | null> {
  if (lat !== undefined && lng !== undefined) {
    return { lat, lng, address: placeId };
  }
  // Fallback: busca reversa via Nominatim usando place_id
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/details?place_id=${placeId}&format=json`,
      { headers: { "User-Agent": "SaquaDrive/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { centroid?: { coordinates: [number, number] } };
    if (data.centroid) {
      const [lon, la] = data.centroid.coordinates;
      return { lat: la, lng: lon, address: "" };
    }
    return null;
  } catch {
    return null;
  }
}

// Rota entre dois pontos via OSRM (gratuito, sem chave)
export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&steps=false`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as {
      routes?: Array<{
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
      }>;
    };

    const route = data.routes?.[0];
    if (!route) return null;

    const polylineCoords = route.geometry.coordinates.map(([lon, la]) => ({
      latitude: la,
      longitude: lon,
    }));

    const distanceKm = route.distance / 1000;
    const durationMin = Math.ceil(route.duration / 60);
    const distanceText =
      distanceKm < 1
        ? `${Math.round(route.distance)} m`
        : `${distanceKm.toFixed(1)} km`;

    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    const duration =
      hours > 0 ? `${hours}h ${mins}min` : `${durationMin} min`;

    return { polylineCoords, distance: distanceKm, duration, distanceText };
  } catch {
    return null;
  }
}

// Geocodificação reversa via Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          "Accept-Language": "pt-BR",
          "User-Agent": "SaquaDrive/1.0",
        },
      }
    );
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json() as { display_name?: string };
    return data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
