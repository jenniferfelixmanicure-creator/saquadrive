import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// Importações no nível do módulo — chamar require() dentro do corpo de um
// componente crasha no Android com New Architecture (TurboModules).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MapLibreGL = require("@maplibre/maplibre-react-native");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reverseGeocode } = require("@/lib/google-maps");


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

function MapLibreMap(props: Props) {
  const {
    origin, destination,
    originColor = "#FF6B00", destColor = "#00C4FF",
    routeCoordinates, driverRealtimeLocation, onMapPress,
  } = props;

  const cameraRef = useRef<ReturnType<typeof MapLibreGL.Camera>>(null);

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
        60, 500
      );
    } else if (origin && destination) {
      cameraRef.current.fitBounds(
        [Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)],
        [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)],
        80, 500
      );
    } else if (driverRealtimeLocation) {
      cameraRef.current.setCamera({
        centerCoordinate: [driverRealtimeLocation.longitude, driverRealtimeLocation.latitude],
        zoomLevel: 15, animationDuration: 500,
      });
    }
  }, [
    origin?.lat, origin?.lng,
    destination?.lat, destination?.lng,
    driverRealtimeLocation?.latitude, driverRealtimeLocation?.longitude,
    routeCoordinates?.length,
  ]);

  const routeGeoJSON =
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

  async function handleMapPress(feature: { geometry: { coordinates: number[] } }) {
    if (!onMapPress) return;
    const [lng, lat] = feature.geometry.coordinates;
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
          <MapLibreGL.PointAnnotation id="origin" coordinate={[origin.lng, origin.lat]}>
            <View style={[styles.markerOuter, { borderColor: "white" }]}>
              <View style={[styles.markerInner, { backgroundColor: originColor }]} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {destination && (
          <MapLibreGL.PointAnnotation id="destination" coordinate={[destination.lng, destination.lat]}>
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
                lineWidth: 4,
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

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function AppMap(props: Props) {
  const [crashed, setCrashed] = useState(false);

  if (crashed) {
    return (
      <View style={[styles.container, styles.fallback]}>
        <Text style={styles.fallbackText}>🗺️</Text>
        <Text style={styles.fallbackLabel}>Mapa não disponível</Text>
      </View>
    );
  }

  return (
    <MapErrorBoundary onError={() => setCrashed(true)}>
      <MapLibreMap {...props} />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  map: { flex: 1 },
  fallback: { alignItems: "center", justifyContent: "center", gap: 8 },
  fallbackText: { fontSize: 48 },
  fallbackLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  markerOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "white",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 5,
  },
  markerInner: { width: 11, height: 11, borderRadius: 5.5 },
  driverMarker: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "white",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  driverEmoji: { fontSize: 20 },
});
