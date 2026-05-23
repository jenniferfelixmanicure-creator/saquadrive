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
  originColor = "#00C4FF",
  destColor = "#0A7AFF",
  routeCoordinates,
}: Props) {
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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #080C10; }
          #map { height: 100vh; width: 100vw; background: #080C10; }
          .leaflet-container { background: #080C10 !important; }
          .leaflet-tile-pane { filter: brightness(0.7) saturate(0.5) hue-rotate(180deg) invert(1); }
          .leaflet-control-attribution { display: none; }
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
              color: 'rgba(255,255,255,0.9)',
              fillColor: '${originColor}',
              fillOpacity: 1,
              radius: 9,
              weight: 2.5
            }).addTo(map);
          }

          if (${!!destination}) {
            var destIcon = L.divIcon({
              className: '',
              html: '<div style="width:20px;height:20px;border-radius:50%;background:${destColor};border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 0 12px ${destColor}99;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });
            L.marker([${destination?.lat}, ${destination?.lng}], { icon: destIcon }).addTo(map);
          }
          
          ${routeCoordinates && routeCoordinates.length > 0 ? `
            var routePoints = ${JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]))};
            L.polyline(routePoints, {
              color: '${originColor}',
              weight: 4,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);
            L.polyline(routePoints, {
              color: '${originColor}',
              weight: 10,
              opacity: 0.15,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);
            var routeLine = L.polyline(routePoints);
            map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
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
  container: { flex: 1, backgroundColor: "#080C10" },
  map: { flex: 1 },
});
