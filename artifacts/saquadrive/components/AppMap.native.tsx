import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
  UserLocation,
  type CameraRef,
  type LngLat,
  type LngLatBounds,
} from "@maplibre/maplibre-react-native";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const SAQUAREMA: LngLat = [-42.51, -22.92];

type LatLng = { lat: number; lng: number };

type Props = {
  isOnline?: boolean;
  origin?: (LatLng & { address?: string }) | null;
  destination?: (LatLng & { address?: string }) | null;
  originColor?: string;
  destColor?: string;
  markerColor?: string;
  mode?: "passenger" | "driver";
  routeCoordinates?: { latitude: number; longitude: number }[];
  driverRealtimeLocation?: { latitude: number; longitude: number } | null;
  onMapPress?: (loc: { address: string; lat: number; lng: number }) => void;
};

export default function AppMap({
  origin,
  destination,
  originColor = "#FF6B00",
  destColor = "#00C4FF",
  routeCoordinates,
  driverRealtimeLocation,
  onMapPress,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);

  const initialCenter: LngLat = origin
    ? [origin.lng, origin.lat]
    : destination
    ? [destination.lng, destination.lat]
    : SAQUAREMA;

  // Fit bounds quando origem e destino estão definidos (como Uber)
  useEffect(() => {
    if (origin && destination && cameraRef.current) {
      const timer = setTimeout(() => {
        const west = Math.min(origin.lng, destination.lng);
        const east = Math.max(origin.lng, destination.lng);
        const south = Math.min(origin.lat, destination.lat);
        const north = Math.max(origin.lat, destination.lat);
        cameraRef.current?.fitBounds(
          [west, south, east, north] as LngLatBounds,
          { padding: { top: 160, right: 60, bottom: 320, left: 60 }, duration: 600 },
        );
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Mostrar motorista + passageiro no mapa (como Uber — ambos visíveis)
  useEffect(() => {
    if (!driverRealtimeLocation || !cameraRef.current) return;
    if (origin) {
      const west = Math.min(driverRealtimeLocation.longitude, origin.lng);
      const east = Math.max(driverRealtimeLocation.longitude, origin.lng);
      const south = Math.min(driverRealtimeLocation.latitude, origin.lat);
      const north = Math.max(driverRealtimeLocation.latitude, origin.lat);
      cameraRef.current.fitBounds(
        [west, south, east, north] as LngLatBounds,
        { padding: { top: 120, right: 60, bottom: 260, left: 60 }, duration: 700 },
      );
    } else {
      cameraRef.current.easeTo({
        center: [driverRealtimeLocation.longitude, driverRealtimeLocation.latitude] as LngLat,
        zoom: 15,
        duration: 800,
      });
    }
  }, [driverRealtimeLocation?.latitude, driverRealtimeLocation?.longitude, origin?.lat, origin?.lng]);

  const routeGeoJSON =
    routeCoordinates && routeCoordinates.length > 1
      ? {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
              },
              properties: {},
            },
          ],
        }
      : null;

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`,
        { headers: { "User-Agent": "ZeroRisco/1.0" } },
      );
      const data = await res.json() as {
        display_name?: string;
        address?: {
          road?: string; house_number?: string; suburb?: string;
          city?: string; town?: string; village?: string;
        };
      };
      if (data?.display_name) {
        const parts: string[] = [];
        if (data.address?.road) parts.push(data.address.road);
        if (data.address?.house_number)
          parts[0] = (parts[0] ?? "") + ", " + data.address.house_number;
        if (data.address?.suburb) parts.push(data.address.suburb);
        const city = data.address?.city ?? data.address?.town ?? data.address?.village;
        if (city) parts.push(city);
        return parts.length > 0 ? parts.join(" — ") : data.display_name;
      }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async function handleMapPress(e: { nativeEvent: { payload: { lngLat: LngLat } } }) {
    if (!onMapPress) return;
    const [lng, lat] = e.nativeEvent.payload.lngLat;
    const address = await reverseGeocode(lat, lng);
    onMapPress({ address, lat, lng });
  }

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={STYLE_URL}
      onPress={onMapPress ? handleMapPress as never : undefined}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: initialCenter, zoom: 14 }}
      />

      <UserLocation />

      {origin && (
        <Marker lngLat={[origin.lng, origin.lat] as LngLat}>
          <View style={[styles.marker, { backgroundColor: originColor }]}>
            <View style={styles.markerInner} />
          </View>
        </Marker>
      )}

      {destination && (
        <Marker lngLat={[destination.lng, destination.lat] as LngLat}>
          <View style={styles.destPin}>
            <View style={[styles.destPinHead, { backgroundColor: destColor }]}>
              <View style={styles.destPinInner} />
            </View>
            <View style={[styles.destPinTail, { borderTopColor: destColor }]} />
          </View>
        </Marker>
      )}

      {driverRealtimeLocation && (
        <Marker
          lngLat={[driverRealtimeLocation.longitude, driverRealtimeLocation.latitude] as LngLat}
        >
          <View style={styles.driverMarker}>
            <Text style={styles.driverMarkerEmoji}>🚗</Text>
          </View>
        </Marker>
      )}

      {routeGeoJSON && (
        <GeoJSONSource id="route" data={routeGeoJSON}>
          <Layer
            id="routeLine"
            type="line"
            paint={{
              "line-color": destColor,
              "line-width": 4,
              "line-opacity": 0.8,
            }}
            layout={{
              "line-join": "round",
              "line-cap": "round",
            }}
          />
        </GeoJSONSource>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  markerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  destPin: {
    alignItems: "center",
  },
  destPinHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  destPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  destPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  driverMarker: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: "#00C4FF",
  },
  driverMarkerEmoji: {
    fontSize: 20,
  },
});
