import * as Sentry from "@sentry/react-native";
  import * as Updates from "expo-updates";
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
  import React, { useEffect, useState } from "react";
  import { registerForPushNotificationsAsync } from "@/lib/notifications";
  import { GestureHandlerRootView } from "react-native-gesture-handler";
  import { SafeAreaProvider } from "react-native-safe-area-context";

  import { ErrorBoundary } from "@/components/ErrorBoundary";
  import { ErrorFallback } from "@/components/ErrorFallback";
  import { AuthProvider } from "@/contexts/AuthContext";
  import { RideProvider } from "@/contexts/RideContext";
  import { SocketProvider } from "@/contexts/SocketContext";

  // ── Sentry ──────────────────────────────────────────────────────────────────
  const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        debug: false,
        tracesSampleRate: 0.1,
        enableNativeNagger: false,
        enableAutoSessionTracking: true,
        attachScreenshot: false,
      });
    } catch {}
  }

  // ── Splash: previne auto-hide e garante fechamento em no máximo 3s ──────────
  try { SplashScreen.preventAutoHideAsync(); } catch {}

  // Failsafe absoluto: splash some após 3s mesmo se o app crashar antes do mount
  const _splashFailsafe = setTimeout(() => {
    try { SplashScreen.hideAsync(); } catch {}
  }, 3000);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 1000 } },
  });

  // ── Captura erros JS globais ─────────────────────────────────────────────────
  let _globalCrashError: Error | null = null;
  try {
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      _globalCrashError = error;
      try { SplashScreen.hideAsync(); } catch {}
      if (SENTRY_DSN) { try { Sentry.captureException(error); } catch {} }
      prev?.(error, isFatal);
    });
  } catch {}

  // ── OTA Update: verifica e aplica silenciosamente ────────────────────────────
  async function checkForOTAUpdate() {
    try {
      if (__DEV__) return;
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch {
      // Nunca bloqueia o app
    }
  }

  // ── Navegação ────────────────────────────────────────────────────────────────
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

  // ── Layout raiz ──────────────────────────────────────────────────────────────
  function RootLayout() {
    const [crashError, setCrashError] = useState<Error | null>(null);

    useFonts({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      ...Feather.font,
    });

    // Esconde splash imediatamente ao montar — não espera fontes nem rede
    useEffect(() => {
      const hideSplash = async () => {
        clearTimeout(_splashFailsafe);
        try {
          await SplashScreen.hideAsync();
          console.log("Splash hidden");
        } catch (e) {
          console.warn("Error hiding splash", e);
        }
      };
      hideSplash();
    }, []);

    // Verifica OTA em background
    useEffect(() => {
      checkForOTAUpdate();
    }, []);

    // Captura erros globais antes do React
    useEffect(() => {
      if (_globalCrashError) setCrashError(_globalCrashError);
      const id = setInterval(() => {
        if (_globalCrashError && !crashError) setCrashError(_globalCrashError);
      }, 500);
      return () => clearInterval(id);
    }, [crashError]);

    // Configura barra de navegação Android
    useEffect(() => {
      try { registerForPushNotificationsAsync(); } catch {}
      if (Platform.OS === "android") {
        try {
          NavigationBar.setVisibilityAsync("hidden").catch(() => {});
          NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
          NavigationBar.setBackgroundColorAsync("#00000000").catch(() => {});
        } catch {}
      }
    }, []);

    if (crashError) {
      return (
        <SafeAreaProvider>
          <ErrorFallback error={crashError} resetError={() => setCrashError(null)} />
        </SafeAreaProvider>
      );
    }

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

  export default Sentry.wrap ? Sentry.wrap(RootLayout) : RootLayout;
  