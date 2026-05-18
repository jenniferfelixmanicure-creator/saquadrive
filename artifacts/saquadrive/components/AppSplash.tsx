import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const BAR_WIDTH = width * 0.55;

export default function AppSplash() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(10)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.1)),
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(450),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(barProgress, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(barProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();

    const pulseDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 380,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
          }),
        ])
      );

    pulseDot(dot1, 0).start();
    pulseDot(dot2, 180).start();
    pulseDot(dot3, 360).start();
  }, []);

  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH],
  });

  return (
    // ImageBackground com a mesma imagem da splash nativa, resizeMode="cover"
    // garante que ocupe 100% da tela em qualquer resolução/Android 12+
    <ImageBackground
      source={require("../assets/images/splash.png")}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Overlay escuro para manter legibilidade sobre a imagem */}
      <LinearGradient
        colors={["rgba(10,10,18,0.72)", "rgba(13,13,26,0.80)", "rgba(13,13,13,0.85)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.glow} />

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrapper,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require("../assets/images/zerorisco_logo_futuristic.png")}
            style={styles.logoImage}
            contentFit="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textGroup,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineY }],
            },
          ]}
        >
          <Text style={styles.brandName}>ZeroRisco</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Sua segurança em primeiro lugar</Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
          ))}
        </View>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </View>

        <Text style={styles.loadingLabel}>Carregando...</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(0,196,255,0.05)",
    top: "28%",
    alignSelf: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
  },

  logoWrapper: {
    alignItems: "center",
    elevation: Platform.OS === "android" ? 8 : 0,
  },

  logoImage: {
    width: 220,
    height: 110,
  },

  textGroup: {
    alignItems: "center",
    gap: 10,
  },

  brandName: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },

  divider: {
    width: 38,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#00C4FF",
    opacity: 0.75,
  },

  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.4,
    textAlign: "center",
    fontWeight: "400",
  },

  bottom: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingHorizontal: 48,
  },

  dotsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#00C4FF",
  },

  barTrack: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#00C4FF",
  },

  loadingLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "500",
  },
});
