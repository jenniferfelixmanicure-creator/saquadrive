import React, { useEffect, useRef, useState } from "react";
  import { StyleSheet, Text, View } from "react-native";

  const MapLibreGL = require("@maplibre/maplibre-react-native");
  const { reverseGeocode } = require("@/lib/google-maps");
  const FACCOES_DATA = require("@/assets/data/faccoes_rj.json");

  const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

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
    onCenterChange?: (lat: number, lng: number) => void;
    navigationMode?: boolean;   // heading-up camera follow for turn-by-turn
  };

  function MapLibreMap(props: Props) {
    const {
      origin, destination,
      originColor = "#00C4FF", destColor = "#0A7AFF",
      routeCoordinates, driverRealtimeLocation, onMapPress, onCenterChange,
      navigationMode = false,
    } = props;

    const cameraRef = useRef<any>(null);

    const center: [number, number] = origin
      ? [origin.lng, origin.lat]
      : destination
      ? [destination.lng, destination.lat]
      : [-42.51, -22.92];

    useEffect(() => {
      // In navigation mode the Camera component handles following automatically
      if (navigationMode) return;
      if (!cameraRef.current) return;
      try {
        if (routeCoordinates && routeCoordinates.length > 1) {
          const lons = routeCoordinates.map((c) => c.longitude);
          const lats = routeCoordinates.map((c) => c.latitude);
          cameraRef.current.fitBounds(
            [Math.max(...lons), Math.max(...lats)],
            [Math.min(...lons), Math.min(...lats)],
            60,
            500
          );
        } else if (origin && destination) {
          cameraRef.current.fitBounds(
            [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)],
            [Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)],
            60,
            500
          );
        } else if (driverRealtimeLocation) {
          cameraRef.current.flyTo(
            [driverRealtimeLocation.longitude, driverRealtimeLocation.latitude],
            500
          );
        }
      } catch {
        // Ignora erros de câmera para não travar o app
      }
    }, [
      navigationMode,
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

    function handleRegionDidChange(feature: { geometry?: { coordinates?: number[] } }) {
      try {
        const coords = feature?.geometry?.coordinates;
        if (!coords) return;
        const [lng, lat] = coords;
        if (typeof lat === "number" && typeof lng === "number") {
          onCenterChange?.(lat, lng);
        }
      } catch {}
    }

    const MapView = MapLibreGL.Map;
    const Marker = MapLibreGL.Marker;
    const GeoJSONSource = MapLibreGL.GeoJSONSource;
    const Layer = MapLibreGL.Layer;
    const Camera = MapLibreGL.Camera;
    const UserLocation = MapLibreGL.UserLocation;

    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          mapStyle={STYLE_URL}
          onPress={onMapPress ? handleMapPress : undefined}
          onRegionDidChange={onCenterChange ? handleRegionDidChange : undefined}
        >
          {navigationMode ? (
            <Camera
              ref={cameraRef}
              followUserLocation={true}
              followUserMode="course"
              followZoomLevel={17}
              animationDuration={300}
            />
          ) : (
            <Camera
              ref={cameraRef}
              center={center}
              zoom={14}
            />
          )}

          <UserLocation visible={true} />

          {origin && (
            <Marker id="origin" coordinate={[origin.lng, origin.lat]}>
              <View style={[styles.markerOuter, { borderColor: "rgba(255,255,255,0.9)" }]}>
                <View style={[styles.markerInner, { backgroundColor: originColor }]} />
              </View>
            </Marker>
          )}

          {destination && (
            <Marker id="destination" coordinate={[destination.lng, destination.lat]}>
              <View style={styles.destMarkerOuter}>
                <View style={[styles.destMarkerPin, { backgroundColor: destColor }]} />
                <View style={[styles.destMarkerTip, { borderTopColor: destColor }]} />
              </View>
            </Marker>
          )}

          {driverRealtimeLocation && (
            <Marker
              id="driver"
              coordinate={[driverRealtimeLocation.longitude, driverRealtimeLocation.latitude]}
            >
              <View style={styles.driverMarker}>
                <Text style={styles.driverEmoji}>🚗</Text>
              </View>
            </Marker>
          )}

          {FACCOES_DATA && (
            <GeoJSONSource id="faccoes" data={FACCOES_DATA}>
              <Layer
                id="faccoesFill"
                type="fill"
                filter={["==", "$type", "Polygon"]}
                paint={{
                  "fill-color": ["get", "fill"],
                  "fill-opacity": 0.4,
                }}
              />
              <Layer
                id="faccoesOutline"
                type="line"
                filter={["==", "$type", "Polygon"]}
                paint={{
                  "line-color": ["get", "stroke"],
                  "line-width": 1,
                }}
              />
              <Layer
                id="faccoesPoints"
                type="circle"
                filter={["==", "$type", "Point"]}
                paint={{
                  "circle-radius": 4,
                  "circle-color": ["get", "stroke"],
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#FFFFFF",
                }}
              />
            </GeoJSONSource>
          )}

          {routeGeoJSON && (
            <GeoJSONSource id="route" data={routeGeoJSON}>
              <Layer
                id="routeLineShadow"
                type="line"
                paint={{
                  "line-color": "#000000",
                  "line-width": 8,
                  "line-opacity": 0.3,
                  "line-blur": 4,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
              <Layer
                id="routeLine"
                type="line"
                paint={{
                  "line-color": originColor,
                  "line-width": 4,
                  "line-opacity": 0.95,
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
              />
            </GeoJSONSource>
          )}
        </MapView>
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
    container: { flex: 1, backgroundColor: "#080C10" },
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
      backgroundColor: "rgba(255,255,255,0.95)",
      shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8, shadowRadius: 8, elevation: 8,
    },
    markerInner: { width: 11, height: 11, borderRadius: 5.5 },
    destMarkerOuter: { alignItems: "center" },
    destMarkerPin: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#0A7AFF", shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9, shadowRadius: 10, elevation: 10,
      borderWidth: 2.5, borderColor: "rgba(255,255,255,0.9)",
    },
    destMarkerTip: {
      width: 0, height: 0,
      borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
      borderLeftColor: "transparent", borderRightColor: "transparent",
      marginTop: -1,
    },
    driverMarker: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
      alignItems: "center", justifyContent: "center",
      shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
    },
    driverEmoji: { fontSize: 22 },
  });
