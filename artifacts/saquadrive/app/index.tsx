import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle, Rect, Path, Line, Ellipse, Defs, LinearGradient as SvgLinearGradient,
  Stop, G, Polyline,
} from "react-native-svg";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Ilustração Passageiro ──────────────────────────────────────────────────
function PassengerIllustration() {
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90">
      <Defs>
        <SvgLinearGradient id="pGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6B00" stopOpacity="1" />
          <Stop offset="1" stopColor="#FF9A00" stopOpacity="1" />
        </SvgLinearGradient>
        <SvgLinearGradient id="pCard" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="rgba(0,0,0,0.25)" stopOpacity="1" />
          <Stop offset="1" stopColor="rgba(0,0,0,0.05)" stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>

      {/* Fundo circular sutil */}
      <Circle cx="45" cy="45" r="42" fill="rgba(255,107,0,0.10)" />
      <Circle cx="45" cy="45" r="34" fill="rgba(255,107,0,0.07)" />

      {/* Estrada / trilha pontilhada */}
      <Line x1="15" y1="72" x2="75" y2="72" stroke="rgba(255,107,0,0.25)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,6" />

      {/* Pin de localização destino */}
      <G transform="translate(56, 26)">
        <Path
          d="M10 0C6.134 0 3 3.134 3 7C3 12.25 10 20 10 20C10 20 17 12.25 17 7C17 3.134 13.866 0 10 0Z"
          fill="url(#pGrad)"
        />
        <Circle cx="10" cy="7" r="3.5" fill="white" />
      </G>

      {/* Linha pontilhada ligando pessoa ao pin */}
      <Line x1="33" y1="48" x2="58" y2="38" stroke="rgba(255,107,0,0.4)" strokeWidth="1.5" strokeDasharray="3,4" strokeLinecap="round" />

      {/* Pessoa / silhueta passageiro */}
      <G transform="translate(18, 32)">
        {/* Cabeça */}
        <Circle cx="15" cy="7" r="6.5" fill="url(#pGrad)" />
        {/* Corpo */}
        <Path
          d="M4 28C4 21 8 17 15 17C22 17 26 21 26 28"
          fill="url(#pGrad)"
        />
        {/* Braço levantado (acenando) */}
        <Path
          d="M24 20 C28 17 30 13 27 10"
          stroke="url(#pGrad)" strokeWidth="3" strokeLinecap="round" fill="none"
        />
        {/* Mão */}
        <Circle cx="27" cy="10" r="2.5" fill="url(#pGrad)" />
      </G>

      {/* Círculo de localização no chão */}
      <Ellipse cx="45" cy="72" rx="12" ry="3.5" fill="rgba(255,107,0,0.18)" />

      {/* Anel de pulso */}
      <Circle cx="45" cy="72" r="16" stroke="rgba(255,107,0,0.12)" strokeWidth="1.5" fill="none" />
      <Circle cx="45" cy="72" r="22" stroke="rgba(255,107,0,0.07)" strokeWidth="1" fill="none" />
    </Svg>
  );
}

// ─── Ilustração Motorista ───────────────────────────────────────────────────
function DriverIllustration() {
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90">
      <Defs>
        <SvgLinearGradient id="dGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#00C4FF" stopOpacity="1" />
          <Stop offset="1" stopColor="#0090D4" stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>

      {/* Fundo circular sutil */}
      <Circle cx="45" cy="45" r="42" fill="rgba(0,196,255,0.08)" />
      <Circle cx="45" cy="45" r="34" fill="rgba(0,196,255,0.05)" />

      {/* Volante — aro externo */}
      <Circle cx="45" cy="45" r="26" stroke="url(#dGrad)" strokeWidth="4" fill="none" />

      {/* Volante — aro interno */}
      <Circle cx="45" cy="45" r="9" stroke="url(#dGrad)" strokeWidth="3" fill="none" />

      {/* Volante — raios */}
      {/* Raio esquerdo */}
      <Path
        d="M36 45 C34 42 32 40 19 40"
        stroke="url(#dGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none"
      />
      {/* Raio direito superior */}
      <Path
        d="M52 38 C54 35 55 32 64 23"
        stroke="url(#dGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none"
      />
      {/* Raio direito inferior */}
      <Path
        d="M52 52 C54 55 55 58 64 67"
        stroke="url(#dGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none"
      />

      {/* Hub central preenchido */}
      <Circle cx="45" cy="45" r="6" fill="url(#dGrad)" />

      {/* Linhas de velocidade / movimento */}
      <Line x1="8" y1="38" x2="16" y2="38" stroke="rgba(0,196,255,0.35)" strokeWidth="2" strokeLinecap="round" />
      <Line x1="5" y1="45" x2="15" y2="45" stroke="rgba(0,196,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="8" y1="52" x2="16" y2="52" stroke="rgba(0,196,255,0.35)" strokeWidth="2" strokeLinecap="round" />

      {/* Estrela de brilho superior direita */}
      <Circle cx="73" cy="20" r="2" fill="rgba(0,196,255,0.6)" />
      <Line x1="73" y1="16" x2="73" y2="24" stroke="rgba(0,196,255,0.4)" strokeWidth="1" strokeLinecap="round" />
      <Line x1="69" y1="20" x2="77" y2="20" stroke="rgba(0,196,255,0.4)" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const { user, mode, isLoading } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading && !loadingTimedOut) return;
    if (!user) return;
    if ((user as { role?: string }).role === "admin") router.replace("/(admin)");
    else if (mode === "passenger") router.replace("/(passenger)");
    else if (mode === "driver") router.replace("/(driver)");
  }, [user, mode, isLoading, loadingTimedOut]);

  const showLoading = isLoading && !loadingTimedOut;

  if (showLoading) {
    return (
      <View style={[styles.container, { backgroundColor: "#0D0D0D" }]}>
        <Image
          source={require("../assets/images/zerorisco_bg_futuristic.png")}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(13,13,13,0.45)", "rgba(13,13,13,0.82)", "#0D0D0D"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.center}>
          <Image
            source={require("../assets/images/zerorisco_logo_futuristic.png")}
            style={styles.splashLogo}
            contentFit="contain"
          />
          <Text style={styles.splashTagline}>MOBILIDADE SAQUAREMA</Text>
          <View style={styles.splashDots}>
            <View style={[styles.splashDot, { backgroundColor: "#FF6B00" }]} />
            <View style={[styles.splashDot, { backgroundColor: "rgba(255,107,0,0.45)" }]} />
            <View style={[styles.splashDot, { backgroundColor: "rgba(255,107,0,0.18)" }]} />
          </View>
        </View>
      </View>
    );
  }

  function handlePassenger() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (user) router.replace("/(passenger)");
    else router.push({ pathname: "/(auth)/login", params: { mode: "passenger" } });
  }

  function handleDriver() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (user) router.replace("/(driver)");
    else router.push({ pathname: "/(auth)/login", params: { mode: "driver" } });
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/zerorisco_bg_futuristic.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(13,13,13,0.35)", "rgba(13,13,13,0.78)", "#0D0D0D"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.inner, { paddingTop: topPad + 36, paddingBottom: botPad + 28 }]}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require("../assets/images/zerorisco_logo_futuristic.png")}
            style={styles.heroLogo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>Mobilidade Segura em Saquarema</Text>
        </View>

        {/* Cards de modo */}
        <View style={styles.modeArea}>
          <Text style={styles.modeTitle}>COMO VOCÊ QUER USAR O APP?</Text>

          {/* ── Passageiro ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePassenger}
            style={styles.cardShadowWrapper}
          >
            <LinearGradient
              colors={["#FF6B00", "#E05A00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              {/* Fundo decorativo */}
              <View style={styles.cardDecorCircle} />

              <View style={styles.cardContent}>
                <View style={styles.illustrationBox}>
                  <PassengerIllustration />
                </View>
                <View style={styles.cardTextGroup}>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>PASSAGEIRO</Text>
                  </View>
                  <Text style={styles.cardTitle}>Quero uma corrida</Text>
                  <Text style={styles.cardDesc}>
                    Solicite de onde estiver e acompanhe em tempo real
                  </Text>
                  <View style={styles.cardArrow}>
                    <Text style={styles.cardArrowText}>Entrar →</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Motorista ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleDriver}
            style={styles.cardShadowWrapper}
          >
            <View style={[styles.card, styles.cardDriver]}>
              {/* Borda gradiente simulada */}
              <LinearGradient
                colors={["rgba(0,196,255,0.35)", "rgba(0,144,212,0.12)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
              />
              {/* Fundo decorativo */}
              <View style={[styles.cardDecorCircle, { backgroundColor: "rgba(0,196,255,0.07)", right: -18, top: -18 }]} />

              <View style={styles.cardContent}>
                <View style={styles.illustrationBox}>
                  <DriverIllustration />
                </View>
                <View style={styles.cardTextGroup}>
                  <View style={[styles.cardBadge, { backgroundColor: "rgba(0,196,255,0.18)" }]}>
                    <Text style={[styles.cardBadgeText, { color: "#00C4FF" }]}>MOTORISTA</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: "#fff" }]}>Quero trabalhar</Text>
                  <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.55)" }]}>
                    Receba corridas e ganhe com flexibilidade
                  </Text>
                  <View style={styles.cardArrow}>
                    <Text style={[styles.cardArrowText, { color: "#00C4FF" }]}>Entrar →</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Rodapé */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Ao continuar, você aceita os </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/terms-of-use")}>
            <Text style={[styles.footerText, { color: "#FF6B00" }]}>Termos de Uso</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  inner: { flex: 1, paddingHorizontal: 22, justifyContent: "space-between" },

  // Splash / loading
  splashLogo: { width: 260, height: 160 },
  splashTagline: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "#FF6B00", letterSpacing: 2.5,
    textTransform: "uppercase", marginTop: 12,
  },
  splashDots: { flexDirection: "row", gap: 8, marginTop: 36 },
  splashDot: { width: 8, height: 8, borderRadius: 4 },

  // Logo
  logoArea: { alignItems: "center", gap: 10 },
  heroLogo: {
    width: 240, height: 120,
  },
  tagline: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "#FF6B00", letterSpacing: 1.4, textTransform: "uppercase",
    textAlign: "center",
  },

  // Cards
  modeArea: { gap: 14 },
  modeTitle: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.4)", textAlign: "center",
    letterSpacing: 2.5, marginBottom: 4,
  },
  cardShadowWrapper: {
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    position: "relative",
  },
  cardDriver: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,196,255,0.22)",
  },
  cardDecorCircle: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)", right: -22, top: -22,
  },
  cardContent: {
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  illustrationBox: {
    width: 90, height: 90, alignItems: "center", justifyContent: "center",
  },
  cardTextGroup: { flex: 1, gap: 5 },
  cardBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginBottom: 2,
  },
  cardBadgeText: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.85)", letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 19, fontFamily: "Inter_700Bold", color: "#fff",
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(0,0,0,0.6)", lineHeight: 17,
  },
  cardArrow: { marginTop: 4 },
  cardArrowText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
  },

  // Rodapé
  footerRow: {
    flexDirection: "row", justifyContent: "center", flexWrap: "wrap",
  },
  footerText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
  },
});
