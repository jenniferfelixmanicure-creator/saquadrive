import React, { useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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
  const webRef = useRef<WebView>(null);

  const center = origin
    ? [origin.lat, origin.lng]
    : destination
    ? [destination.lat, destination.lng]
    : [-22.92, -42.51];

  function buildHtml(
    orig: typeof origin,
    dest: typeof destination,
    route: typeof routeCoordinates,
    driver: typeof driverRealtimeLocation,
  ) {
    const originJs = orig
      ? `L.circleMarker([${orig.lat}, ${orig.lng}], {
          color: 'white', fillColor: '${originColor}',
          fillOpacity: 1, radius: 9, weight: 3
        }).addTo(map).bindTooltip('Origem', {permanent:false});`
      : '';
    const destJs = dest
      ? `
        var destIcon = L.divIcon({
          html: '<div style="width:22px;height:22px;border-radius:50%;background:${destColor};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>',
          className:'', iconAnchor:[11,11]
        });
        L.marker([${dest.lat}, ${dest.lng}], {icon:destIcon}).addTo(map).bindTooltip('Destino', {permanent:false});
      `
      : '';
    const driverJs = driver
      ? `
        var driverIcon = L.divIcon({
          html: '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">🚗</div>',
          className:'', iconAnchor:[12,12]
        });
        var driverMarker = L.marker([${driver.latitude}, ${driver.longitude}], {icon:driverIcon}).addTo(map);
      `
      : '';
    const routeJs =
      route && route.length > 1
        ? `
          var pts = ${JSON.stringify(route.map((c) => [c.latitude, c.longitude]))};
          var poly = L.polyline(pts, {color:'${destColor}',weight:5,opacity:0.85,lineJoin:'round'}).addTo(map);
          ${orig && dest ? `map.fitBounds(poly.getBounds(), {padding:[60,60]});` : ''}
        `
        : orig && dest
        ? `map.fitBounds(L.latLngBounds([${orig.lat},${orig.lng}],[${dest.lat},${dest.lng}]),{padding:[80,80]});`
        : '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body,html{height:100%;overflow:hidden;background:#0D0D0D}
    #map{height:100vh;width:100vw;background:#0D0D0D}
    .leaflet-tile-pane{filter:invert(100%) hue-rotate(180deg) brightness(92%) contrast(88%)}
    .leaflet-container{background:#1a1a1a!important}
    .leaflet-control-zoom{display:none}
    .leaflet-control-attribution{font-size:8px;opacity:0.4;background:transparent!important;color:#fff!important}
    .leaflet-control-attribution a{color:#aaa!important}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:true}).setView([${center[0]},${center[1]}],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  ${originJs}
  ${destJs}
  ${driverJs}
  ${routeJs}
  map.on('click',function(e){
    var lat=e.latlng.lat, lng=e.latlng.lng;
    fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=pt-BR',
      {headers:{'User-Agent':'ZeroRisco/1.0'}})
      .then(r=>r.json()).then(function(d){
        var addr=d.display_name||lat.toFixed(5)+', '+lng.toFixed(5);
        if(d.address){
          var parts=[];
          if(d.address.road)parts.push(d.address.road+(d.address.house_number?', '+d.address.house_number:''));
          if(d.address.suburb)parts.push(d.address.suburb);
          var city=d.address.city||d.address.town||d.address.village;
          if(city)parts.push(city);
          if(parts.length)addr=parts.join(' — ');
        }
        window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng,address:addr}));
      }).catch(function(){
        window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng,address:lat.toFixed(5)+', '+lng.toFixed(5)}));
      });
  });
</script>
</body>
</html>`;
  }

  const htmlRef = useRef(buildHtml(origin, destination, routeCoordinates, driverRealtimeLocation));

  useEffect(() => {
    if (!webRef.current) return;
    const newHtml = buildHtml(origin, destination, routeCoordinates, driverRealtimeLocation);
    htmlRef.current = newHtml;
    webRef.current.reload();
  }, [
    origin?.lat, origin?.lng,
    destination?.lat, destination?.lng,
    driverRealtimeLocation?.latitude, driverRealtimeLocation?.longitude,
    routeCoordinates?.length,
  ]);

  function handleMessage(e: WebViewMessageEvent) {
    if (!onMapPress) return;
    try {
      const data = JSON.parse(e.nativeEvent.data);
      onMapPress(data);
    } catch {}
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: htmlRef.current }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  map: { flex: 1 },
});
