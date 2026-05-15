import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapLibreGL from "@maplibre/maplibre-react-native";

MapLibreGL.setAccessToken(null);

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const SAQUAREMA: [number, number] = [-42.51, -22.92];

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
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const center: [number, number] = origin
    ? [origin.lng, origin.lat]
    : destination
    ? [destination.lng, destination.lat]
    : SAQUAREMA;

  useEffect(() => {
    if (origin && destination && cameraRef.current) {
      const timer = setTimeout(() => {
        cameraRef.current?.fitBounds(
          [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)],
          [Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)],
          [160, 60, 320, 60],
          600
        );
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  useEffect(() => {
    if (driverRealtimeLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [driverRealtimeLocation.longitude, driverRealtimeLocation.latitude],
        zoomLevel: 15,
        animationDuration: 800,
      });
    }
  }, [driverRealtimeLocation]);

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
        { headers: { "User-Agent": "ZeroRisco/1.0" } }
      );
      const data = await res.json();
      if (data?.display_name) {
        const parts: string[] = [];
        if (data.address?.road) parts.push(data.address.road);
        if (data.address?.house_number) parts[0] = (parts[0] ?? "") + ", " + data.address.house_number;
        if (data.address?.suburb) parts.push(data.address.suburb);
        if (data.address?.city || data.address?.town || data.address?.village)
          parts.push(data.address.city ?? data.address.town ?? data.address.village);
        return parts.length > 0 ? parts.join(" — ") : data.display_name;
      }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async function handleMapPress(e: { geometry: { coordinates: [number, number] } }) {
    if (!onMapPress) return;
    const [lng, lat] = e.geometry.coordinates;
    const address = await reverseGeocode(lat, lng);
    onMapPress({ address, lat, lng });
  }

  return (
    <MapLibreGL.MapView
      style={StyleSheet.absoluteFill}
      styleURL={STYLE_URL}
      onPress={onMapPress ? handleMapPress : undefined}
      compassEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
    >
      <MapLibreGL.Camera
        ref={cameraRef}
        zoomLevel={14}
        centerCoordinate={center}
      />

      <MapLibreGL.UserLocation visible />

      {origin && (
        <MapLibreGL.PointAnnotation
          id="origin"
          coordinate={[origin.lng, origin.lat]}
        >
          <View style={[styles.marker, { backgroundColor: originColor }]}>
            <View style={styles.markerInner} />
          </View>
        </MapLibreGL.PointAnnotation>
      )}

      {destination && (
        <MapLibreGL.PointAnnotation
          id="destination"
          coordinate={[destination.lng, destination.lat]}
        >
          <View style={styles.destPin}>
            <View style={[styles.destPinHead, { backgroundColor: destColor }]}>
              <View style={styles.destPinInner} />
            </View>
            <View style={[styles.destPinTail, { borderTopColor: destColor }]} />
          </View>
        </MapLibreGL.PointAnnotation>
      )}

      {driverRealtimeLocation && (
        <MapLibreGL.PointAnnotation
          id="driver"
          coordinate={[driverRealtimeLocation.longitude, driverRealtimeLocation.latitude]}
        >
          <View style={styles.driverMarker}>
            <Text style={styles.driverMarkerEmoji}>🚗</Text>
          </View>
        </MapLibreGL.PointAnnotation>
      )}

      {routeGeoJSON && (
        <MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
          <MapLibreGL.LineLayer
            id="routeLine"
            style={{
              lineColor: destColor,
              lineWidth: 4,
              lineOpacity: 0.8,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        </MapLibreGL.ShapeSource>
      )}
    </MapLibreGL.MapView>
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
