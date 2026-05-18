import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as NavigationBar from "expo-navigation-bar";
import { Platform } from "react-native";
import React, { useEffect } from "react";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppSplash from "@/components/AppSplash";
import { AuthProvider } from "@/contexts/AuthContext";
import { RideProvider } from "@/contexts/RideContext";
import { SocketProvider } from "@/contexts/SocketContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(passenger)" options={{ headerShown: false }} />
      <Stack.Screen name="(driver)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  // Técnica "fake splash": esconde a splash nativa IMEDIATAMENTE e
  // exibe o AppSplash (React Native) como substituto — 100% sob controle,
  // sem limitações do Android 12+.
  // O estado minTimeElapsed garante que o AppSplash apareça por pelo menos
  // MIN_SPLASH_MS ms, evitando flash branco em dispositivos rápidos.
  const MIN_SPLASH_MS = 2000;
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);

  useEffect(() => {
    // 1) Esconde splash nativa antes do primeiro frame
    SplashScreen.hideAsync().catch(() => {});
    // 2) Garante tempo mínimo de exibição do AppSplash
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      registerForPushNotificationsAsync();
    } catch (e) {}

    if (Platform.OS === "android") {
      try {
        NavigationBar.setVisibilityAsync("hidden");
        NavigationBar.setBehaviorAsync("overlay-swipe");
        NavigationBar.setBackgroundColorAsync("#00000000");
      } catch (e) {}
    }
  }, []);

  const appReady = (fontsLoaded || !!fontError) && minTimeElapsed;
  if (!appReady) return <AppSplash />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <SocketProvider>
                  <RideProvider>
                    <RootLayoutNav />
                  </RideProvider>
                </SocketProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
