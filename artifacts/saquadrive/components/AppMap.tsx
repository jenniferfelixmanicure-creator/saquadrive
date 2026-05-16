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
};

export default function AppMap({
  origin,
  destination,
  originColor = "#00C4FF",
  destColor = "#FF6B00",
  routeCoordinates,
  driverRealtimeLocation,
  onMapPress,
}: Props) {
  const center = origin ? [origin.lat, origin.lng] : [-22.9200, -42.5100];

  const handleMessage = onMapPress ? `
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapPress',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }));
    });
  ` : "";

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
    body { background: #0D0D0D; overflow: hidden; }
    #map { height: 100vh; width: 100vw; background: #0D0D0D; }

    /* Esconde atribuição padrão do leaflet para visual limpo */
    .leaflet-control-attribution { display: none; }
    .leaflet-control-zoom { display: none; }

    /* Marcador pulsante da origem */
    .pulse-marker {
      position: relative;
      width: 20px;
      height: 20px;
    }
    .pulse-dot {
      width: 14px;
      height: 14px;
      background: ${originColor};
      border: 2.5px solid #fff;
      border-radius: 50%;
      position: absolute;
      top: 3px;
      left: 3px;
      box-shadow: 0 0 10px ${originColor}99, 0 0 20px ${originColor}55;
    }
    .pulse-ring {
      width: 20px;
      height: 20px;
      border: 2px solid ${originColor};
      border-radius: 50%;
      position: absolute;
      top: 0;
      left: 0;
      animation: pulse 2s ease-out infinite;
      opacity: 0;
    }
    .pulse-ring-2 {
      animation-delay: 0.75s;
    }
    .pulse-ring-3 {
      animation-delay: 1.5s;
    }
    @keyframes pulse {
      0%   { transform: scale(1);   opacity: 0.8; }
      100% { transform: scale(3.5); opacity: 0; }
    }

    /* Marcador de destino */
    .dest-pin {
      width: 28px;
      height: 36px;
      position: relative;
      filter: drop-shadow(0 4px 8px ${destColor}88);
    }

    /* Marcador do motorista */
    .driver-marker {
      width: 36px;
      height: 36px;
      background: #1A1A1A;
      border: 2px solid ${originColor};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 12px ${originColor}66, 0 2px 8px rgba(0,0,0,0.6);
      animation: driverGlow 2s ease-in-out infinite alternate;
    }
    @keyframes driverGlow {
      from { box-shadow: 0 0 8px ${originColor}44, 0 2px 8px rgba(0,0,0,0.6); }
      to   { box-shadow: 0 0 20px ${originColor}99, 0 2px 8px rgba(0,0,0,0.6); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Mapa com tiles CartoDB Dark Matter (visual muito mais bonito)
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
    }).setView([${center[0]}, ${center[1]}], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // ── Marcador de origem (pulsante) ──────────────────────────────
    ${origin ? `
    var originEl = document.createElement('div');
    originEl.className = 'pulse-marker';
    originEl.innerHTML = '<div class="pulse-ring"></div><div class="pulse-ring pulse-ring-2"></div><div class="pulse-ring pulse-ring-3"></div><div class="pulse-dot"></div>';
    var originIcon = L.divIcon({ html: originEl.outerHTML, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
    L.marker([${origin.lat}, ${origin.lng}], { icon: originIcon }).addTo(map);
    ` : ''}

    // ── Marcador de destino (pin com sombra) ───────────────────────
    ${destination ? `
    var destSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><defs><radialGradient id="pg" cx="50%" cy="35%" r="60%"><stop offset="0%" stop-color="${destColor}"/><stop offset="100%" stop-color="${destColor}cc"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M14 0C7.373 0 2 5.373 2 12c0 8.5 12 24 12 24s12-15.5 12-24c0-6.627-5.373-12-12-12z" fill="url(#pg)" filter="url(#glow)"/><circle cx="14" cy="12" r="5" fill="white" opacity="0.9"/></svg>';
    var destIcon = L.divIcon({ html: destSvg, className: '', iconSize: [28, 36], iconAnchor: [14, 36] });
    L.marker([${destination.lat}, ${destination.lng}], { icon: destIcon }).addTo(map);
    ` : ''}

    // ── Motorista em tempo real ────────────────────────────────────
    ${driverRealtimeLocation ? `
    var driverEl = '<div class="driver-marker">🚗</div>';
    var driverIcon = L.divIcon({ html: driverEl, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });
    L.marker([${driverRealtimeLocation.latitude}, ${driverRealtimeLocation.longitude}], { icon: driverIcon }).addTo(map);
    ` : ''}

    // ── Rota com brilho (camadas múltiplas) ────────────────────────
    ${routeCoordinates && routeCoordinates.length > 0 ? `
    var routePoints = ${JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]))};

    // Camada de brilho externo (mais larga, transparente)
    L.polyline(routePoints, {
      color: '${originColor}',
      weight: 14,
      opacity: 0.08,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Camada de brilho médio
    L.polyline(routePoints, {
      color: '${originColor}',
      weight: 8,
      opacity: 0.18,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Linha principal
    L.polyline(routePoints, {
      color: '${originColor}',
      weight: 4,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Linha central brilhante
    L.polyline(routePoints, {
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.35,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    var poly = L.polyline(routePoints);
    map.fitBounds(poly.getBounds(), { padding: [60, 60] });
    ` : ''}

    // ── Handler de toque no mapa ───────────────────────────────────
    ${handleMessage}
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={
          onMapPress
            ? (event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === "mapPress") {
                    onMapPress({ address: "Local selecionado", lat: data.lat, lng: data.lng });
                  }
                } catch (_) {}
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  map: { flex: 1 },
});
