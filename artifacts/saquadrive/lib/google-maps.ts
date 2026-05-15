const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyBr--KxYjgHbY7uoaeAzYsnc3y4iuK4hjs";

// Decodifica polyline encoded do Google Maps
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export type RouteResult = {
  polylineCoords: { latitude: number; longitude: number }[];
  distance: number;
  duration: string;
  distanceText: string;
};

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.lat},${origin.lng}` +
        `&destination=${destination.lat},${destination.lng}` +
        `&key=${GOOGLE_MAPS_API_KEY}` +
        `&language=pt-BR`
    );
    const data = await res.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      const polylineCoords = decodePolyline(route.overview_polyline.points);

      return {
        polylineCoords,
        distance: leg.distance.value / 1000,
        duration: leg.duration.text,
        distanceText: leg.distance.text,
      };
    }
    console.warn("[GoogleMaps] Status:", data.status, data.error_message ?? "");
    return null;
  } catch (error) {
    console.error("[GoogleMaps] getRoute error:", error);
    return null;
  }
}

export async function searchPlaces(query: string) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(query)}` +
        `&key=${GOOGLE_MAPS_API_KEY}` +
        `&language=pt-BR` +
        `&components=country:br`
    );
    const data = await res.json();
    return data.predictions ?? [];
  } catch (error) {
    console.error("[GoogleMaps] searchPlaces error:", error);
    return [];
  }
}

export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${placeId}` +
        `&key=${GOOGLE_MAPS_API_KEY}` +
        `&language=pt-BR`
    );
    const data = await res.json();
    if (data.status === "OK") {
      const loc = data.result.geometry.location;
      return {
        lat: loc.lat,
        lng: loc.lng,
        address: data.result.formatted_address,
      };
    }
    return null;
  } catch (error) {
    console.error("[GoogleMaps] getPlaceDetails error:", error);
    return null;
  }
}
