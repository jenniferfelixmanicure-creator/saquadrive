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

// ─── Turn-by-Turn Navigation ──────────────────────────────────────────────────

export type NavStep = {
  distance: number;           // metros até a próxima manobra
  instruction: string;        // instrução em português
  maneuverIcon: string;       // nome do ícone Feather
  streetName: string;
  coordinate: { latitude: number; longitude: number }; // ponto da manobra
  remainingDistance: number;  // metros restantes após esse passo
  remainingDuration: number;  // segundos restantes
};

export type RouteWithStepsResult = RouteResult & {
  steps: NavStep[];
  totalDurationSec: number;
};

function buildInstruction(type: string, modifier?: string, street?: string): string {
  const via = street && street.trim() ? ` na ${street}` : "";
  const mod = modifier ?? "";
  switch (type) {
    case "depart":     return `Siga em frente${via}`;
    case "arrive":     return "Você chegou ao destino";
    case "turn":
      if (mod.includes("uturn"))        return "Faça o retorno";
      if (mod.includes("sharp right"))  return `Vire acentuadamente à direita${via}`;
      if (mod.includes("sharp left"))   return `Vire acentuadamente à esquerda${via}`;
      if (mod.includes("slight right")) return `Mantenha-se à direita${via}`;
      if (mod.includes("slight left"))  return `Mantenha-se à esquerda${via}`;
      if (mod.includes("right"))        return `Vire à direita${via}`;
      if (mod.includes("left"))         return `Vire à esquerda${via}`;
      return `Continue${via}`;
    case "merge":
      return `Mescle${mod.includes("left") ? " à esquerda" : " à direita"}${via}`;
    case "on ramp":    return `Entre na rampa${via}`;
    case "off ramp":   return `Saia na saída${via}`;
    case "fork":
      return `Na bifurcação, siga${mod.includes("left") ? " à esquerda" : " à direita"}${via}`;
    case "end of road":
      return `No fim da via, vire${mod.includes("left") ? " à esquerda" : " à direita"}${via}`;
    case "roundabout":
    case "rotary":     return `Na rotatória, siga${via}`;
    case "continue":   return `Continue${via}`;
    default:           return `Continue${via}`;
  }
}

function getManeuverIcon(type: string, modifier?: string): string {
  const mod = modifier ?? "";
  if (type === "arrive")   return "map-pin";
  if (type === "depart")   return "navigation";
  if (type === "roundabout" || type === "rotary") return "rotate-cw";
  if (mod.includes("uturn"))        return "rotate-ccw";
  if (mod.includes("sharp right") || (mod.includes("right") && !mod.includes("slight"))) return "corner-down-right";
  if (mod.includes("sharp left")  || (mod.includes("left")  && !mod.includes("slight"))) return "corner-down-left";
  if (mod.includes("slight right")) return "arrow-up-right";
  if (mod.includes("slight left"))  return "arrow-up-left";
  return "arrow-up";
}

export async function getRouteWithSteps(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteWithStepsResult | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as {
      routes?: Array<{
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
        legs: Array<{
          steps: Array<{
            distance: number;
            duration: number;
            name: string;
            maneuver: {
              type: string;
              modifier?: string;
              location: [number, number];
            };
          }>;
        }>;
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
    const duration = hours > 0 ? `${hours}h ${mins}min` : `${durationMin} min`;

    const rawSteps = route.legs?.[0]?.steps ?? [];
    let accumulated = route.distance;

    const steps: NavStep[] = rawSteps.map((s) => {
      const [lng, lat] = s.maneuver.location;
      const step: NavStep = {
        distance: s.distance,
        instruction: buildInstruction(s.maneuver.type, s.maneuver.modifier, s.name),
        maneuverIcon: getManeuverIcon(s.maneuver.type, s.maneuver.modifier),
        streetName: s.name ?? "",
        coordinate: { latitude: lat, longitude: lng },
        remainingDistance: accumulated,
        remainingDuration: Math.ceil(s.duration),
      };
      accumulated -= s.distance;
      return step;
    });

    return {
      polylineCoords,
      distance: distanceKm,
      duration,
      distanceText,
      steps,
      totalDurationSec: route.duration,
    };
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
