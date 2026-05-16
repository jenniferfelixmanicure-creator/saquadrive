import * as Sentry from "@sentry/react-native";
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
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorFallback } from "@/components/ErrorFallback";
import { AuthProvider } from "@/contexts/AuthContext";
import { RideProvider } from "@/contexts/RideContext";
import { SocketProvider } from "@/contexts/SocketContext";

// Inicializa Sentry o mais cedo possível — captura crashes nativos e JS
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    tracesSampleRate: 0.1,
    enableNativeNagger: false,
    enableAutoSessionTracking: true,
    attachScreenshot: false,
  });
}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Failsafe: garante que a splash some em no máximo 6s,
// mesmo que ocorra um crash antes do useEffect rodar.
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);

const queryClient = new QueryClient();

// Captura erros JS globais fora do React
let _globalCrashError: Error | null = null;
try {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    _globalCrashError = error;
    if (SENTRY_DSN) Sentry.captureException(error);
    prev?.(error, isFatal);
  });
} catch {}

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

function RootLayout() {
  const [crashError, setCrashError] = useState<Error | null>(null);

  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  // Esconde splash imediatamente — sem bloquear por fontes
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Verifica erros globais capturados antes do React
  useEffect(() => {
    if (_globalCrashError) setCrashError(_globalCrashError);
    const id = setInterval(() => {
      if (_globalCrashError && !crashError) setCrashError(_globalCrashError);
    }, 500);
    return () => clearInterval(id);
  }, [crashError]);

  useEffect(() => {
    registerForPushNotificationsAsync();
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
      NavigationBar.setBackgroundColorAsync("#00000000").catch(() => {});
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

export default Sentry.wrap(RootLayout);

