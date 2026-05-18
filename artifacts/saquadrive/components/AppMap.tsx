import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Location } from "@/contexts/RideContext";

type Props = {
  isOnline?: boolean;
  destination?: Location | null;
  origin?: Location;
  originColor?: string;
  destColor?: string;
  markerColor?: string;
  mode?: "passenger" | "driver";
  driverRealtimeLocation?: { latitude: number; longitude: number } | null;
  routeCoordinates?: { latitude: number; longitude: number }[];
  onMapPress?: (location: Location) => void;
  onCenterChange?: (lat: number, lng: number) => void;
};

export default function AppMap({
  origin,
  destination,
  originColor = "#FF6B00",
  destColor = "#00C4FF",
  routeCoordinates,
}: Props) {
  // Saquarema como fallback
  const center = origin ? [origin.lat, origin.lng] : [-22.9200, -42.5100];
  
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; background: #0D0D0D; }
          .leaflet-container { background: #0D0D0D !important; }
          .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${center[0]}, ${center[1]}], 15);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          if (${!!origin}) {
            L.circleMarker([${origin?.lat}, ${origin?.lng}], {
              color: 'white',
              fillColor: '${originColor}',
              fillOpacity: 1,
              radius: 8,
              weight: 2
            }).addTo(map);
          }

          if (${!!destination}) {
            L.circleMarker([${destination?.lat}, ${destination?.lng}], {
              color: 'white',
              fillColor: '${destColor}',
              fillOpacity: 1,
              radius: 8,
              weight: 2
            }).addTo(map);
          }
          
          ${routeCoordinates && routeCoordinates.length > 0 ? `
            var routePoints = ${JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]))};
            var polyline = L.polyline(routePoints, {
              color: '${destColor}',
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round'
            }).addTo(map);
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          ` : ''}
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView 
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  map: { flex: 1 },
});
