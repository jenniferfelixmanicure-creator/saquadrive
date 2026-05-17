import MapLibreGL from "@maplibre/maplibre-react-native";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { reverseGeocode } from "@/lib/google-maps";

MapLibreGL.setAccessToken(null);

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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
    : [-42.51, -22.92];

  useEffect(() => {
    if (!cameraRef.current) return;

    if (routeCoordinates && routeCoordinates.length > 1) {
      const lons = routeCoordinates.map((c) => c.longitude);
      const lats = routeCoordinates.map((c) => c.latitude);
      cameraRef.current.fitBounds(
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
        60,
        500
      );
    } else if (origin && destination) {
      cameraRef.current.fitBounds(
        [Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)],
        [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)],
        80,
        500
      );
    } else if (driverRealtimeLocation) {
      cameraRef.current.setCamera({
        centerCoordinate: [driverRealtimeLocation.longitude, driverRealtimeLocation.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  }, [
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    driverRealtimeLocation?.latitude,
    driverRealtimeLocation?.longitude,
    routeCoordinates?.length,
  ]);

  const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null =
    routeCoordinates && routeCoordinates.length > 1
      ? {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
          },
        }
      : null;

  async function handleMapPress(feature: GeoJSON.Feature) {
    if (!onMapPress) return;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    const lng = coords[0];
    const lat = coords[1];
    const address = await reverseGeocode(lat, lng);
    onMapPress({ lat, lng, address });
  }

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={STYLE_URL}
        onPress={onMapPress ? handleMapPress : undefined}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          centerCoordinate={center}
          zoomLevel={14}
          animationMode="flyTo"
          animationDuration={400}
        />

        {origin && (
          <MapLibreGL.PointAnnotation
            id="origin"
            coordinate={[origin.lng, origin.lat]}
          >
            <View style={[styles.markerOuter, { borderColor: "white" }]}>
              <View style={[styles.markerInner, { backgroundColor: originColor }]} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {destination && (
          <MapLibreGL.PointAnnotation
            id="destination"
            coordinate={[destination.lng, destination.lat]}
          >
            <View style={[styles.markerOuter, { borderColor: "white" }]}>
              <View style={[styles.markerInner, { backgroundColor: destColor }]} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {driverRealtimeLocation && (
          <MapLibreGL.PointAnnotation
            id="driver"
            coordinate={[driverRealtimeLocation.longitude, driverRealtimeLocation.latitude]}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverEmoji}>🚗</Text>
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {routeGeoJSON && (
          <MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{
                lineColor: destColor,
                lineWidth: 5,
                lineOpacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  map: { flex: 1 },
  markerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  markerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverMarker: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  driverEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
});
