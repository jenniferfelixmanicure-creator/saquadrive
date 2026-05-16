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

  // ── Splash — previne auto-hide e garante fechamento em no máximo 3s ─────────
  try { SplashScreen.preventAutoHideAsync(); } catch {}

  const _splashFailsafe = setTimeout(() => {
    try { SplashScreen.hideAsync(); } catch {}
  }, 3000);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, retryDelay: 1000 },
    },
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

  // ── KeyboardProvider com fallback seguro ─────────────────────────────────────
  let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kbModule = require("react-native-keyboard-controller");
    KeyboardProvider = kbModule.KeyboardProvider ?? null;
  } catch {}

  function SafeKeyboardProvider({ children }: { children: React.ReactNode }) {
    if (KeyboardProvider) {
      try {
        return <KeyboardProvider>{children}</KeyboardProvider>;
      } catch {
        return <>{children}</>;
      }
    }
    return <>{children}</>;
  }

  // ── OTA Update — verifica e aplica atualização silenciosamente ───────────────
  async function checkForOTAUpdate() {
    try {
      // Só verifica em builds de produção (não em dev/Expo Go)
      if (__DEV__ || !Updates.isEmbeddedLaunch === false) return;
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        // Reinicia o app para aplicar a atualização
        await Updates.reloadAsync();
      }
    } catch {
      // Falha silenciosa — nunca bloqueia o app
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

    // 1. Esconde splash assim que o componente monta — não espera fontes nem rede
    useEffect(() => {
      clearTimeout(_splashFailsafe);
      try { SplashScreen.hideAsync(); } catch {}
    }, []);

    // 2. Verifica atualização OTA em background (não bloqueia a UI)
    useEffect(() => {
      checkForOTAUpdate();
    }, []);

    // 3. Verifica erros globais capturados antes do React montar
    useEffect(() => {
      if (_globalCrashError) setCrashError(_globalCrashError);
      const id = setInterval(() => {
        if (_globalCrashError && !crashError) setCrashError(_globalCrashError);
      }, 500);
      return () => clearInterval(id);
    }, [crashError]);

    // 4. Configura barra de navegação Android
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
              <SafeKeyboardProvider>
                <AuthProvider>
                  <SocketProvider>
                    <RideProvider>
                      <RootLayoutNav />
                    </RideProvider>
                  </SocketProvider>
                </AuthProvider>
              </SafeKeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  export default Sentry.wrap ? Sentry.wrap(RootLayout) : RootLayout;
  