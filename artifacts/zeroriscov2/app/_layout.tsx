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
  import { GestureHandlerRootView } from "react-native-gesture-handler";
  import { SafeAreaProvider } from "react-native-safe-area-context";

  import { ErrorBoundary } from "@/components/ErrorBoundary";
  import { AuthProvider } from "@/contexts/AuthContext";
  import { RideProvider } from "@/contexts/RideContext";
  import { SocketProvider } from "@/contexts/SocketContext";

  // Impede que a splash some sozinha antes do JS esconder
  try { SplashScreen.preventAutoHideAsync(); } catch {}

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 1000 } },
  });

  function RootLayoutNav() {
    return (
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(passenger)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    );
  }

  function RootLayout() {
    useFonts({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      ...Feather.font,
    });

    // ── Esconde splash assim que o componente monta ──────────────────────────
    // Não espera fontes, rede ou qualquer coisa assíncrona.
    useEffect(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, []);

    // ── Configura barra de navegação Android ─────────────────────────────────
    useEffect(() => {
      if (Platform.OS !== "android") return;
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
      NavigationBar.setBackgroundColorAsync("#00000000").catch(() => {});
    }, []);

    return (
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AuthProvider>
                <SocketProvider>
                  <RideProvider>
                    <RootLayoutNav />
                  </RideProvider>
                </SocketProvider>
              </AuthProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  export default RootLayout;
  